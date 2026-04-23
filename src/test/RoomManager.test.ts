import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from '@/lib/RoomManager'

describe('RoomManager', () => {
  let roomManager: RoomManager

  beforeEach(() => {
    roomManager = new RoomManager()
  })

  it('should create a room with a 6-character code', () => {
    const room = roomManager.createRoom()
    expect(room.code).toHaveLength(6)
    expect(room.status).toBe('waiting')
  })

  it('should join a player to a room', () => {
    const room = roomManager.createRoom()
    const player = roomManager.joinRoom(room.code, 'TestPlayer', true)
    
    expect(player.name).toBe('TestPlayer')
    expect(player.isHost).toBe(true)
    
    const updatedRoom = roomManager.getRoom(room.code)
    expect(updatedRoom?.players).toHaveLength(1)
    expect(updatedRoom?.players[0].name).toBe('TestPlayer')
  })

  it('should not join a room that does not exist', () => {
    expect(() => {
      roomManager.joinRoom('NONEXIST', 'Player', false)
    }).toThrow('Room not found')
  })

  it('should not allow duplicate names in the same room', () => {
    const room = roomManager.createRoom()
    roomManager.joinRoom(room.code, 'Player1', true)
    
    expect(() => {
      roomManager.joinRoom(room.code, 'Player1', false)
    }).toThrow('Player name already taken')
  })

  it('should move to battling after round 6 finishes', () => {
    const room = roomManager.createRoom()
    const host = roomManager.joinRoom(room.code, 'Host', true)
    const guest = roomManager.joinRoom(room.code, 'Guest', false)
    roomManager.startDraft(room.code)

    const setupRoom = roomManager.getRoom(room.code)!
    setupRoom.players.find(player => player.id === host.id)!.team = {
      strikers: [101, 102, 103, 104],
      specials: [201, 202],
    }
    setupRoom.players.find(player => player.id === guest.id)!.team = {
      strikers: [105, 106, 107, 108],
      specials: [203, 204],
    }

    for (let i = 1; i < 6; i++) {
      roomManager.nextRound(room.code)
    }

    const beforeBattle = roomManager.getRoom(room.code)!
    expect(beforeBattle.currentRound).toBe(6)
    expect(beforeBattle.status).toBe('drafting')

    roomManager.nextRound(room.code)

    const battlingRoom = roomManager.getRoom(room.code)!
    expect(battlingRoom.status).toBe('battling')
  })

  it('should not move to battling before all players have 6 characters', () => {
    const room = roomManager.createRoom()
    const host = roomManager.joinRoom(room.code, 'Host', true)
    const guest = roomManager.joinRoom(room.code, 'Guest', false)
    roomManager.startDraft(room.code)

    const setupRoom = roomManager.getRoom(room.code)!
    setupRoom.currentRound = 6
    setupRoom.players.find(player => player.id === host.id)!.team = {
      strikers: [101, 102, 103, 104],
      specials: [201],
    }
    setupRoom.players.find(player => player.id === guest.id)!.team = {
      strikers: [105, 106, 107, 108],
      specials: [202, 203],
    }

    expect(() => roomManager.nextRound(room.code)).toThrow('全プレイヤーの編成が完了していません')
    expect(roomManager.getRoom(room.code)!.status).toBe('drafting')
  })

  it('should remove a disconnected player and promote a new host when needed', () => {
    const room = roomManager.createRoom()
    const host = roomManager.joinRoom(room.code, 'Host', true)
    const guest = roomManager.joinRoom(room.code, 'Guest', false)

    roomManager.submitPick(room.code, host.id, 101, 'striker')
    const updatedRoom = roomManager.removePlayer(room.code, host.id)!

    expect(updatedRoom.players).toHaveLength(1)
    expect(updatedRoom.players[0].id).toBe(guest.id)
    expect(updatedRoom.players[0].isHost).toBe(true)
    expect(updatedRoom.draftHistory).toEqual([])
  })

  it('should restart the same room with cleared teams and waiting status', () => {
    const room = roomManager.createRoom()
    const host = roomManager.joinRoom(room.code, 'Host', true)
    const guest = roomManager.joinRoom(room.code, 'Guest', false)
    roomManager.startDraft(room.code)

    const activeRoom = roomManager.getRoom(room.code)!
    activeRoom.status = 'battling'
    activeRoom.currentRound = 6
    activeRoom.players.find(player => player.id === host.id)!.team = {
      strikers: [101, 102, 103, 104],
      specials: [201, 202],
    }
    activeRoom.players.find(player => player.id === guest.id)!.team = {
      strikers: [105, 106, 107, 108],
      specials: [203, 204],
    }
    activeRoom.draftHistory.push({ round: 6, playerId: host.id, studentId: 101, studentRole: 'striker', isReplacement: false })
    activeRoom.abandonedStudentIds = [999]
    activeRoom.conflictStudentIds = [888]

    const restartedRoom = roomManager.restartRoom(room.code)

    expect(restartedRoom.status).toBe('waiting')
    expect(restartedRoom.currentRound).toBe(1)
    expect(restartedRoom.currentPhase).toBe('picking')
    expect(restartedRoom.players.every(player => player.team.strikers.length === 0 && player.team.specials.length === 0)).toBe(true)
    expect(restartedRoom.players.every(player => player.lastPickStatus === 'pending')).toBe(true)
    expect(restartedRoom.draftHistory).toEqual([])
    expect(restartedRoom.abandonedStudentIds).toEqual([])
    expect(restartedRoom.conflictStudentIds).toEqual([])
  })

})
