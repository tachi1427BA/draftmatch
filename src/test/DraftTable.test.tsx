import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import DraftTable from '@/components/DraftTable'
import { socket } from '@/lib/socket'

// Mock socket
vi.mock('@/lib/socket', () => {
  const handlers: Record<string, Function> = {}
  return {
    socket: {
      on: vi.fn((event, handler) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      emit: vi.fn(),
      // Helper to trigger events in tests
      _trigger: (event: string, data: any) => {
        if (handlers[event]) handlers[event](data)
      }
    }
  }
})

describe('DraftTable Component', () => {
  const mockStudents = [
    { id: 1, name: 'Student 1', icon: '/icon1.png' }
  ]

  it('renders room code and waiting status after socket update', async () => {
    render(
      <DraftTable 
        roomCode="TEST01" 
        playerName="HostPlayer" 
        isHost={true} 
        students={mockStudents} 
      />
    )
    
    // Should show loading first
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument()

    // Trigger room update
    await act(async () => {
      ;(socket as any)._trigger('room-updated', {
        code: 'TEST01',
        status: 'waiting',
        currentRound: 1,
        currentPhase: 'picking',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' }
        ],
        draftHistory: [],
        conflictStudentIds: []
      })
    })

    expect(screen.getByText(/Room: TEST01/)).toBeInTheDocument()
    expect(screen.getByText(/待機中/)).toBeInTheDocument()
  })
})
