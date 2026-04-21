import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from '@/lib/RoomManager'

describe('DraftLogic', () => {
  let roomManager: RoomManager

  beforeEach(() => {
    roomManager = new RoomManager()
  })

  it('should resolve unique picks successfully', () => {
    const room = roomManager.createRoom()
    const p1 = roomManager.joinRoom(room.code, 'P1', true)
    const p2 = roomManager.joinRoom(room.code, 'P2', false)

    roomManager.submitPick(room.code, p1.id, 101, 'striker')
    roomManager.submitPick(room.code, p2.id, 102, 'striker')

    roomManager.resolvePicks(room.code)

    const updatedRoom = roomManager.getRoom(room.code)!
    expect(updatedRoom.players.find(p => p.id === p1.id)!.team.strikers).toContain(101)
    expect(updatedRoom.players.find(p => p.id === p2.id)!.team.strikers).toContain(102)
    expect(updatedRoom.currentPhase).toBe('abandoning')
  })

  it('should allow selecting special students in early rounds and preserve role grouping', () => {
    const room = roomManager.createRoom()
    const p1 = roomManager.joinRoom(room.code, 'P1', true)
    const p2 = roomManager.joinRoom(room.code, 'P2', false)

    roomManager.submitPick(room.code, p1.id, 101, 'special')
    roomManager.submitPick(room.code, p2.id, 101, 'special')

    roomManager.resolvePicks(room.code)

    const updatedRoom = roomManager.getRoom(room.code)!
    const first = updatedRoom.players.find(p => p.id === p1.id)!
    const second = updatedRoom.players.find(p => p.id === p2.id)!
    expect(first.team.specials.length + second.team.specials.length).toBe(1)
    expect([first.lastPickStatus, second.lastPickStatus]).toContain('won')
    expect([first.lastPickStatus, second.lastPickStatus]).toContain('lost')
    expect(updatedRoom.currentPhase).toBe('picking')
  })

  it('should resolve duplicate picks by picking one winner', () => {
    const room = roomManager.createRoom()
    const p1 = roomManager.joinRoom(room.code, 'P1', true)
    const p2 = roomManager.joinRoom(room.code, 'P2', false)

    // Both pick the same student
    roomManager.submitPick(room.code, p1.id, 101, 'striker')
    roomManager.submitPick(room.code, p2.id, 101, 'striker')

    roomManager.resolvePicks(room.code)

    const updatedRoom = roomManager.getRoom(room.code)!
    const p1Final = updatedRoom.players.find(p => p.id === p1.id)!
    const p2Final = updatedRoom.players.find(p => p.id === p2.id)!

    // One should have won, one should have lost
    const results = [p1Final.lastPickStatus, p2Final.lastPickStatus]
    expect(results).toContain('won')
    expect(results).toContain('lost')
    
    // Total history should only have 1 entry (the winner)
    expect(updatedRoom.draftHistory).toHaveLength(1)
    expect(updatedRoom.currentPhase).toBe('picking') // Stay in picking phase for the loser to re-pick
  })

  it('should not double-add a student when winner re-resolves after loser re-picks', () => {
    const room = roomManager.createRoom()
    const p1 = roomManager.joinRoom(room.code, 'P1', true)
    const p2 = roomManager.joinRoom(room.code, 'P2', false)
    roomManager.startDraft(room.code)

    // Round 1: P1 picks 101, P2 picks 102 → both win
    roomManager.submitPick(room.code, p1.id, 101, 'striker')
    roomManager.submitPick(room.code, p2.id, 102, 'striker')
    roomManager.resolvePicks(room.code)

    // Both won → abandoning phase. Advance to round 2.
    roomManager.nextRound(room.code)

    // Round 2: both pick same student 201
    roomManager.submitPick(room.code, p1.id, 201, 'striker')
    roomManager.submitPick(room.code, p2.id, 201, 'striker')
    roomManager.resolvePicks(room.code)

    // One won, one lost. Loser re-picks a different student.
    const r2 = roomManager.getRoom(room.code)!
    const winner = r2.players.find(p => p.lastPickStatus === 'won')!
    const loser = r2.players.find(p => p.lastPickStatus === 'lost')!

    roomManager.submitPick(room.code, loser.id, 202, 'striker')
    roomManager.resolvePicks(room.code)

    const final = roomManager.getRoom(room.code)!
    const winnerFinal = final.players.find(p => p.id === winner.id)!
    const loserFinal = final.players.find(p => p.id === loser.id)!

    // Winner should have exactly 2 strikers: 201 (round 2) + round 1 pick
    expect(winnerFinal.team.strikers).toHaveLength(2)
    // Loser should have exactly 2 strikers: round 1 pick + 202
    expect(loserFinal.team.strikers).toHaveLength(2)
    // Student 201 should appear in winner's team exactly once
    expect(winnerFinal.team.strikers.filter(id => id === 201)).toHaveLength(1)
  })
})
