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
    roomManager.joinRoom(room.code, 'Host', true)
    roomManager.joinRoom(room.code, 'Guest', false)
    roomManager.startDraft(room.code)

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
})
