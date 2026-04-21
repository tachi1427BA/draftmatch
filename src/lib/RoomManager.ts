export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  team: {
    strikers: number[];
    specials: number[];
  };
  lastPickStatus: 'pending' | 'won' | 'lost' | 'abandoned' | 'finished_round';
}

export interface Room {
  code: string;
  status: 'waiting' | 'drafting' | 'battling' | 'finished';
  currentRound: number;
  currentPhase: 'picking' | 'resolving' | 'abandoning';
  players: Player[];
  draftHistory: {
    round: number;
    playerId: string;
    studentId: number;
    studentRole: 'striker' | 'special';
    isReplacement: boolean;
  }[];
  abandonedStudentIds: number[];
  /** Student IDs currently in conflict (populated during 'resolving' phase, cleared after). */
  conflictStudentIds: number[];
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(): Room {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room: Room = {
      code,
      status: 'waiting',
      currentRound: 1,
      currentPhase: 'picking',
      players: [],
      draftHistory: [],
      abandonedStudentIds: [],
      conflictStudentIds: []
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  joinRoom(code: string, playerName: string, isHost: boolean): Player {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    if (room.players.find(p => p.name === playerName)) {
      throw new Error('Player name already taken');
    }

    const player: Player = {
      id: Math.random().toString(36).substring(2, 11),
      name: playerName,
      isHost,
      team: { strikers: [], specials: [] },
      lastPickStatus: 'pending'
    };

    room.players.push(player);
    return player;
  }

  submitPick(code: string, playerId: string, studentId: number, studentRole: 'striker' | 'special') {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    // Rule validation: Availability
    // Block only students already on someone's team (definitively won) or abandoned.
    // Multiple players may pick the same student in the same round — conflicts are resolved by resolvePicks.
    const isAlreadyPicked = room.players.some(p =>
      p.team.strikers.includes(studentId) || p.team.specials.includes(studentId)
    );
    const isAbandoned = room.abandonedStudentIds.includes(studentId);
    if (isAlreadyPicked || isAbandoned) {
      throw new Error('この生徒は既に指名されているか、放棄されているため選択できません');
    }

    const isReplacement = player.lastPickStatus === 'abandoned';

    if (isReplacement) {
      if (studentRole === 'striker') player.team.strikers.push(studentId);
      else player.team.specials.push(studentId);

      player.lastPickStatus = 'finished_round';
      room.draftHistory.push({
        round: room.currentRound,
        playerId,
        studentId,
        studentRole,
        isReplacement: true
      });
    } else {
      // Remove any existing pending/re-pick entry for this player this round before adding a new one.
      room.draftHistory = room.draftHistory.filter(
        h => !(h.playerId === playerId && h.round === room.currentRound && !h.isReplacement)
      );
      player.lastPickStatus = 'pending';
      room.draftHistory.push({
        round: room.currentRound,
        playerId,
        studentId,
        studentRole,
        isReplacement: false
      });
    }
  }

  resolvePicks(code: string) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    // Clear conflict info now that resolution is happening.
    room.conflictStudentIds = [];

    // Only resolve picks from players currently waiting for resolution (pending).
    // This prevents re-processing already-won players' old history entries on subsequent resolves.
    const pendingPlayerIds = new Set(
      room.players
        .filter(p => p.lastPickStatus === 'pending')
        .map(p => p.id)
    );

    const currentPicks = room.draftHistory.filter(
      h => h.round === room.currentRound && !h.isReplacement && pendingPlayerIds.has(h.playerId)
    );
    
    const picksByStudent: Record<number, string[]> = {};
    currentPicks.forEach(p => {
      if (!picksByStudent[p.studentId]) picksByStudent[p.studentId] = [];
      picksByStudent[p.studentId].push(p.playerId);
    });

    const winners: string[] = [];
    const losers: string[] = [];

    for (const studentIdStr in picksByStudent) {
      const studentId = parseInt(studentIdStr);
      const playerIds = picksByStudent[studentId];
      
      if (playerIds.length === 1) {
        winners.push(playerIds[0]);
      } else {
        const winnerIndex = Math.floor(Math.random() * playerIds.length);
        playerIds.forEach((pid, idx) => {
          if (idx === winnerIndex) winners.push(pid);
          else losers.push(pid);
        });
      }
    }

    room.players.forEach(p => {
      if (winners.includes(p.id)) {
        p.lastPickStatus = 'won';
        const pick = currentPicks.find(h => h.playerId === p.id)!;
        if (pick.studentRole === 'striker') p.team.strikers.push(pick.studentId);
        else p.team.specials.push(pick.studentId);
      } else if (losers.includes(p.id)) {
        p.lastPickStatus = 'lost';
        room.draftHistory = room.draftHistory.filter(h => !(h.playerId === p.id && h.round === room.currentRound));
      }
    });

    if (losers.length === 0) {
      room.currentPhase = 'abandoning';
    } else {
      room.currentPhase = 'picking';
    }
  }

  abandonChoice(code: string, playerId: string, abandon: boolean) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    if (player.lastPickStatus !== 'won') throw new Error('放棄できるのは獲得済みのプレイヤーのみです');

    const winningPick = room.draftHistory.find(
      h => h.playerId === playerId && h.round === room.currentRound && !h.isReplacement
    );
    if (!winningPick) throw new Error('勝利した指名が見つかりませんでした');

    if (abandon) {
      const targetArray = winningPick.studentRole === 'striker' ? player.team.strikers : player.team.specials;
      const index = targetArray.indexOf(winningPick.studentId);
      if (index !== -1) {
        targetArray.splice(index, 1);
      }
      room.abandonedStudentIds.push(winningPick.studentId);
      player.lastPickStatus = 'abandoned';
    } else {
      player.lastPickStatus = 'finished_round';
    }
  }

  startDraft(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.status = 'drafting';
    room.currentRound = 1;
    room.currentPhase = 'picking';
    room.players.forEach(p => p.lastPickStatus = 'pending');
  }

  nextRound(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    
    if (room.currentRound >= 6) {
      room.status = 'battling';
    } else {
      room.currentRound++;
      room.currentPhase = 'picking';
      room.players.forEach(p => p.lastPickStatus = 'pending');
    }
  }

  removeRoom(code: string) {
    this.rooms.delete(code);
  }
}
