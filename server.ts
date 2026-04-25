import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { RoomManager } from "./src/lib/RoomManager";
import { Student } from "./src/lib/studentLoader";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000");
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const roomManager = new RoomManager();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
    // Allow polling fallback for environments that restrict WebSocket upgrades.
    transports: ["websocket", "polling"],
  });

  // Track which room/player each socket belongs to for cleanup on disconnect.
  const socketMap = new Map<string, { roomCode: string; playerId: string }>();

  const emitRoomUpdate = (roomCode: string) => {
    io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
  };

  const syncRoomState = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const activePlayerIds = new Set(room.players.map(player => player.id));
    const activePickers = room.players.filter(player => ['pending', 'lost'].includes(player.lastPickStatus));
    const allSubmitted = activePickers.every(player =>
      room.draftHistory.some(history =>
        history.playerId === player.id &&
        history.round === room.currentRound &&
        !history.isReplacement
      )
    );

    if (activePickers.length === 0 || !allSubmitted) {
      emitRoomUpdate(roomCode);
      return;
    }

    const currentPicks = room.draftHistory.filter(
      history =>
        history.round === room.currentRound &&
        !history.isReplacement &&
        activePlayerIds.has(history.playerId)
    );
    const picksByStudent: Record<number, string[]> = {};
    currentPicks.forEach(history => {
      if (!picksByStudent[history.studentId]) picksByStudent[history.studentId] = [];
      picksByStudent[history.studentId].push(history.playerId);
    });
    const conflictIds = Object.keys(picksByStudent)
      .filter(studentId => picksByStudent[parseInt(studentId, 10)].length > 1)
      .map(Number);

    if (conflictIds.length > 0) {
      room.currentPhase = 'resolving';
      room.conflictStudentIds = conflictIds;
      emitRoomUpdate(roomCode);

      setTimeout(() => {
        if (!roomManager.getRoom(roomCode)) return;
        roomManager.resolvePicks(roomCode);
        emitRoomUpdate(roomCode);
      }, 2500);
      return;
    }

    roomManager.resolvePicks(roomCode);
    emitRoomUpdate(roomCode);
  };

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("get-room", (roomCode: string) => {
      const room = roomManager.getRoom(roomCode);
      if (room) socket.emit("room-updated", room);
    });

    socket.on("create-room", (playerName: string, callback) => {
      const room = roomManager.createRoom();
      const player = roomManager.joinRoom(room.code, playerName, true);
      socket.join(room.code);
      socketMap.set(socket.id, { roomCode: room.code, playerId: player.id });
      callback({ roomCode: room.code, player });
      io.to(room.code).emit("room-updated", roomManager.getRoom(room.code));
    });

    socket.on("join-room", ({ roomCode, playerName }: { roomCode: string, playerName: string }, callback) => {
      try {
        const player = roomManager.joinRoom(roomCode, playerName, false);
        socket.join(roomCode);
        socketMap.set(socket.id, { roomCode, playerId: player.id });
        callback({ player });
        io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
      } catch (e: any) {
        callback({ error: e.message });
      }
    });

    socket.on("submit-pick", ({ roomCode, playerId, student }: { roomCode: string, playerId: string, student: Student }) => {
      try {
        roomManager.submitPick(roomCode, playerId, student.id, student.role);
        syncRoomState(roomCode);
      } catch (e: any) {
        // You could emit an error event here
        console.error("Pick error:", e.message);
      }
    });

    socket.on("abandon-choice", ({ roomCode, playerId, abandon }: { roomCode: string, playerId: string, abandon: boolean }) => {
      try {
        roomManager.abandonChoice(roomCode, playerId, abandon);
        io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
      } catch (e: any) {
        console.error("Abandon error:", e.message);
      }
    });

    socket.on("next-round", (roomCode: string) => {
      try {
        roomManager.nextRound(roomCode);
        io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
      } catch (e: any) {
        console.error("Next round error:", e.message);
      }
    });

    socket.on("start-draft", (roomCode: string) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      roomManager.startDraft(roomCode);
      const startedRoom = roomManager.getRoom(roomCode);

      console.log(
        "[draft-start] room " + roomCode + " members:",
        startedRoom?.players.map(player => ({
          id: player.id,
          name: player.name,
          isHost: player.isHost,
          lastPickStatus: player.lastPickStatus,
          team: {
            strikers: player.team.strikers.length,
            specials: player.team.specials.length,
          },
        }))
      );

      io.to(roomCode).emit("room-updated", startedRoom);
    });

    socket.on("start-battle-timer", ({ roomCode, durationSeconds }: { roomCode: string; durationSeconds: number }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.status !== "battling") return;
      const safeDurationSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.floor(durationSeconds)
        : 10 * 60;

      io.to(roomCode).emit("battle-timer-started", {
        startedAt: Date.now(),
        durationSeconds: safeDurationSeconds,
      });
    });

    socket.on("restart-room", (roomCode: string) => {
      try {
        roomManager.restartRoom(roomCode);
        io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
      } catch (e: any) {
        console.error("Restart room error:", e.message);
      }
    });

    socket.on("close-room", (roomCode: string) => {
      try {
        io.to(roomCode).emit("room-closed");
        roomManager.removeRoom(roomCode);
      } catch (e: any) {
        console.error("Close room error:", e.message);
      }
    });

    socket.on("disconnect", () => {
      const info = socketMap.get(socket.id);
      if (info) {
        socketMap.delete(socket.id);
        const { roomCode, playerId } = info;
        const updatedRoom = roomManager.removePlayer(roomCode, playerId);

        if (!updatedRoom) {
          console.log(`Room ${roomCode} removed (all players disconnected)`);
        } else {
          syncRoomState(roomCode);
        }
      }
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
