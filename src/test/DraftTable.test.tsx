import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import DraftTable from '@/components/DraftTable'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'

// Mock socket
vi.mock('@/lib/socket', () => {
  const handlers: Record<string, Function> = {}
  const socket = {
    connected: true,
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    off: vi.fn(),
    emit: vi.fn(),
    _trigger: (event: string, data: any) => {
      if (handlers[event]) handlers[event](data)
    }
  }

  return {
    connectSocket: vi.fn(async () => socket),
    getSocket: vi.fn(() => socket),
    disconnectSocket: vi.fn(),
  }
})

describe('DraftTable Component', () => {
  const mockStudents = [
    { id: 1, name: 'Student 1', icon: '/icon1.png', role: 'striker' as const }
  ]

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders room code and waiting status after socket update', async () => {
    render(
      <DraftTable 
        roomCode="TEST01" 
        playerName="HostPlayer" 
        isHost={true} 
        students={mockStudents}
        onLeave={vi.fn()}
      />
    )
    
    // Should show loading first
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument()

    // Trigger room update
    await act(async () => {
      ;((await connectSocket()) as any)._trigger('room-updated', {
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

  it('starts a 10 minute countdown when battle begins', async () => {
    vi.useFakeTimers()

    render(
      <DraftTable
        roomCode="TEST01"
        playerName="HostPlayer"
        isHost={true}
        students={mockStudents}
        onLeave={vi.fn()}
      />
    )

    await act(async () => {
      ;((await connectSocket()) as any)._trigger('room-updated', {
        code: 'TEST01',
        status: 'battling',
        currentRound: 6,
        currentPhase: 'abandoning',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [1, 2, 3, 4], specials: [5, 6] }, lastPickStatus: 'finished_round' }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    expect(screen.getByRole('button', { name: 'タイマー開始' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'タイマー開始' }))

    expect(getSocket()?.emit).toHaveBeenCalledWith('start-battle-timer', { roomCode: 'TEST01', durationSeconds: 600 })

    await act(async () => {
      ;((await connectSocket()) as any)._trigger('battle-timer-started', {
        startedAt: Date.now(),
        durationSeconds: 600
      })
    })

    expect(screen.getByText('10:00')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('09:59')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(599000)
    })

    expect(screen.getByText('00:00')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('lets the host change the battle timer length before starting', async () => {
    vi.useFakeTimers()

    render(
      <DraftTable
        roomCode="TEST01"
        playerName="HostPlayer"
        isHost={true}
        students={mockStudents}
        onLeave={vi.fn()}
      />
    )

    await act(async () => {
      ;((await connectSocket()) as any)._trigger('room-updated', {
        code: 'TEST01',
        status: 'battling',
        currentRound: 6,
        currentPhase: 'abandoning',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [1, 2, 3, 4], specials: [5, 6] }, lastPickStatus: 'finished_round' }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    fireEvent.change(screen.getByLabelText('タイマー分数'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'タイマー開始' }))

    expect(getSocket()?.emit).toHaveBeenCalledWith('start-battle-timer', { roomCode: 'TEST01', durationSeconds: 900 })

    await act(async () => {
      ;((await connectSocket()) as any)._trigger('battle-timer-started', {
        startedAt: Date.now(),
        durationSeconds: 900
      })
    })

    expect(screen.getByText('15:00')).toBeInTheDocument()
  })

  it('shows waiting message for non-host players before the timer starts', async () => {
    render(
      <DraftTable
        roomCode="TEST01"
        playerName="GuestPlayer"
        isHost={false}
        students={mockStudents}
        onLeave={vi.fn()}
      />
    )

    await act(async () => {
      ;((await connectSocket()) as any)._trigger('room-updated', {
        code: 'TEST01',
        status: 'battling',
        currentRound: 6,
        currentPhase: 'abandoning',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [1, 2, 3, 4], specials: [5, 6] }, lastPickStatus: 'finished_round' },
          { id: '2', name: 'GuestPlayer', isHost: false, team: { strikers: [7, 8, 9, 10], specials: [11, 12] }, lastPickStatus: 'finished_round' }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    expect(screen.getByText('ホストがタイマーを開始するのを待っています...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'タイマー開始' })).not.toBeInTheDocument()
  })

  it('disconnects and leaves when returning to top', async () => {
    const onLeave = vi.fn()

    render(
      <DraftTable
        roomCode="TEST01"
        playerName="HostPlayer"
        isHost={true}
        students={mockStudents}
        onLeave={onLeave}
      />
    )

    await act(async () => {
      ;((await connectSocket()) as any)._trigger('room-updated', {
        code: 'TEST01',
        status: 'battling',
        currentRound: 6,
        currentPhase: 'abandoning',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [1, 2, 3, 4], specials: [5, 6] }, lastPickStatus: 'finished_round' }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'トップに戻る' }))

    expect(disconnectSocket).toHaveBeenCalled()
    expect(onLeave).toHaveBeenCalled()
  })
})
