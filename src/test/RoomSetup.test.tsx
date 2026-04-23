import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import RoomSetup from '@/components/RoomSetup'
import { connectSocket } from '@/lib/socket'

vi.mock('@/lib/socket', () => {
  const socket = {
    emit: vi.fn(),
  }

  return {
    connectSocket: vi.fn(async () => socket),
    getSocket: vi.fn(() => socket),
    disconnectSocket: vi.fn(),
  }
})

describe('RoomSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not connect on initial render', () => {
    render(<RoomSetup onJoin={vi.fn()} />)

    expect(connectSocket).not.toHaveBeenCalled()
  })

  it('connects when creating a room', async () => {
    const onJoin = vi.fn()
    render(<RoomSetup onJoin={onJoin} />)

    fireEvent.change(screen.getByPlaceholderText('シャーレの先生'), { target: { value: 'HostPlayer' } })
    fireEvent.click(screen.getByRole('button', { name: '新しくルームを作成' }))

    await waitFor(() => {
      expect(connectSocket).toHaveBeenCalled()
    })
  })

  it('connects when joining a room', async () => {
    const onJoin = vi.fn()
    render(<RoomSetup onJoin={onJoin} />)

    fireEvent.change(screen.getByPlaceholderText('シャーレの先生'), { target: { value: 'GuestPlayer' } })
    fireEvent.change(screen.getByPlaceholderText('ABCD12'), { target: { value: 'test01' } })
    fireEvent.click(screen.getByRole('button', { name: '参加' }))

    await waitFor(() => {
      expect(connectSocket).toHaveBeenCalled()
    })
  })
})
