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
    { id: 1, name: 'Student 1', icon: '/icon1.png', role: 'striker' as const },
    { id: 2, name: 'Student 2', icon: '/icon2.png', role: 'special' as const },
  ]
  const clipboardWriteText = vi.fn()
  const audioPlay = vi.fn(() => Promise.resolve())
  const audioPause = vi.fn()

  afterEach(() => {
    vi.useRealTimers()
  })

  Object.assign(navigator, {
    clipboard: {
      writeText: clipboardWriteText,
    },
  })

  HTMLMediaElement.prototype.play = audioPlay
  HTMLMediaElement.prototype.pause = audioPause

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

  it('copies the room id to clipboard', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'ルームIDをコピー' }))

    expect(clipboardWriteText).toHaveBeenCalledWith('TEST01')
    expect(await screen.findByText('コピー済み')).toBeInTheDocument()
  })

  it('uses a full-width layout without forcing the old fixed width', async () => {
    const { container } = render(
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

    expect(container.firstChild).toHaveClass('w-full')
    expect(container.firstChild).not.toHaveClass('overflow-x-auto')
    expect(screen.getByTestId('player-board-strip')).toBeInTheDocument()
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

    expect(audioPlay).toHaveBeenCalled()

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

  it('does not show next-round button on round 6 when a player only has 5 characters', async () => {
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
        status: 'drafting',
        currentRound: 6,
        currentPhase: 'abandoning',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [1, 2, 3, 4], specials: [5] }, lastPickStatus: 'finished_round' },
          { id: '2', name: 'GuestPlayer', isHost: false, team: { strikers: [6, 7, 8, 9], specials: [10, 11] }, lastPickStatus: 'finished_round' }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    expect(screen.queryByRole('button', { name: '次の巡目へ進む' })).not.toBeInTheDocument()
    expect(screen.getByText('全プレイヤーが 4 ストライカー / 2 スペシャル になるまでバトルを開始できません')).toBeInTheDocument()
  })

  it('does not show next-round button while an abandoned player is re-picking', async () => {
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
        status: 'drafting',
        currentRound: 2,
        currentPhase: 'abandoning',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [1], specials: [] }, lastPickStatus: 'finished_round' },
          { id: '2', name: 'GuestPlayer', isHost: false, team: { strikers: [2], specials: [] }, lastPickStatus: 'abandoned' }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    expect(screen.queryByRole('button', { name: '次の巡目へ進む' })).not.toBeInTheDocument()
  })

  it('disables special students when the player already has 2 specials', async () => {
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
        status: 'drafting',
        currentRound: 6,
        currentPhase: 'picking',
        players: [
          {
            id: '1',
            name: 'HostPlayer',
            isHost: true,
            team: { strikers: [101, 102, 103, 104], specials: [201, 202] },
            lastPickStatus: 'abandoned'
          }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    expect(screen.getByTitle('Student 2')).toBeDisabled()
  })

  it('renders all 6 slots when the final special replacement is completed', async () => {
    const students = [
      { id: 101, name: 'A', icon: '/icon1.png', role: 'striker' as const },
      { id: 102, name: 'B', icon: '/icon1.png', role: 'striker' as const },
      { id: 103, name: 'C', icon: '/icon1.png', role: 'striker' as const },
      { id: 104, name: 'D', icon: '/icon1.png', role: 'striker' as const },
      { id: 201, name: 'E', icon: '/icon1.png', role: 'special' as const },
      { id: 303, name: 'F', icon: '/icon1.png', role: 'special' as const },
    ]

    render(
      <DraftTable
        roomCode="TEST01"
        playerName="HostPlayer"
        isHost={true}
        students={students}
        onLeave={vi.fn()}
      />
    )

    await act(async () => {
      ;((await connectSocket()) as any)._trigger('room-updated', {
        code: 'TEST01',
        status: 'drafting',
        currentRound: 6,
        currentPhase: 'abandoning',
        players: [
          {
            id: '1',
            name: 'HostPlayer',
            isHost: true,
            team: { strikers: [101, 102, 103, 104], specials: [201, 303] },
            lastPickStatus: 'finished_round'
          }
        ],
        draftHistory: [],
        abandonedStudentIds: [],
        conflictStudentIds: []
      })
    })

    expect(screen.queryByText('S1')).not.toBeInTheDocument()
    expect(screen.queryByText('S2')).not.toBeInTheDocument()
    expect(screen.queryByText('S3')).not.toBeInTheDocument()
    expect(screen.queryByText('S4')).not.toBeInTheDocument()
    expect(screen.queryByText('P1')).not.toBeInTheDocument()
    expect(screen.queryByText('P2')).not.toBeInTheDocument()
  })

  it('uses wider player boards when there are fewer players', async () => {
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
        status: 'waiting',
        currentRound: 1,
        currentPhase: 'picking',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
          { id: '2', name: 'GuestPlayer', isHost: false, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
        ],
        draftHistory: [],
        conflictStudentIds: []
      })
    })

    const boards = screen.getAllByTestId('compact-player-board')
    expect(boards[0]).toHaveClass('min-w-[320px]', 'basis-[320px]')
  })

  it('uses narrower player boards when there are more players', async () => {
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
        status: 'waiting',
        currentRound: 1,
        currentPhase: 'picking',
        players: [
          { id: '1', name: 'HostPlayer', isHost: true, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
          { id: '2', name: 'GuestPlayer1', isHost: false, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
          { id: '3', name: 'GuestPlayer2', isHost: false, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
          { id: '4', name: 'GuestPlayer3', isHost: false, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
          { id: '5', name: 'GuestPlayer4', isHost: false, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
          { id: '6', name: 'GuestPlayer5', isHost: false, team: { strikers: [], specials: [] }, lastPickStatus: 'pending' },
        ],
        draftHistory: [],
        conflictStudentIds: []
      })
    })

    const boards = screen.getAllByTestId('compact-player-board')
    expect(boards[0]).toHaveClass('min-w-[208px]', 'basis-[208px]')
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
