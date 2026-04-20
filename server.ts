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

  const io = new Server(httpServer);

  // Track which room/player each socket belongs to for cleanup on disconnect.
  const socketMap = new Map<string, { roomCode: string; playerId: string }>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

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
        const room = roomManager.getRoom(roomCode);
        if (room) {
          // Resolve when all players who still need to pick (pending or lost) have submitted.
          const activePickers = room.players.filter(p => ['pending', 'lost'].includes(p.lastPickStatus));
          const allSubmitted = activePickers.every(p =>
            room.draftHistory.some(h => h.playerId === p.id && h.round === room.currentRound && !h.isReplacement)
          );
          if (activePickers.length > 0 && allSubmitted) {
            // Detect conflicts (multiple players picked the same student).
            const currentPicks = room.draftHistory.filter(
              h => h.round === room.currentRound && !h.isReplacement
            );
            const picksByStudent: Record<number, string[]> = {};
            currentPicks.forEach(h => {
              if (!picksByStudent[h.studentId]) picksByStudent[h.studentId] = [];
              picksByStudent[h.studentId].push(h.playerId);
            });
            const conflictIds = Object.keys(picksByStudent)
              .filter(id => picksByStudent[parseInt(id)].length > 1)
              .map(Number);

            if (conflictIds.length > 0) {
              // Enter 'resolving' phase so clients can show the lottery animation.
              room.currentPhase = 'resolving';
              room.conflictStudentIds = conflictIds;
              io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));

              // After 2.5 s, resolve picks and broadcast the result.
              setTimeout(() => {
                roomManager.resolvePicks(roomCode);
                io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
              }, 2500);
            } else {
              roomManager.resolvePicks(roomCode);
              io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
            }
          } else {
            io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
          }
        }
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
      roomManager.nextRound(roomCode);
      io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
    });

    socket.on("start-draft", (roomCode: string) => {
      roomManager.startDraft(roomCode);
      io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
    });

    socket.on("disconnect", () => {
      const info = socketMap.get(socket.id);
      if (info) {
        socketMap.delete(socket.id);
        const { roomCode } = info;
        // Remove the room if no sockets remain in it.
        const roomSockets = [...socketMap.values()].filter(v => v.roomCode === roomCode);
        if (roomSockets.length === 0) {
          roomManager.removeRoom(roomCode);
          console.log(`Room ${roomCode} removed (all players disconnected)`);
        } else {
          io.to(roomCode).emit("room-updated", roomManager.getRoom(roomCode));
        }
      }
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
