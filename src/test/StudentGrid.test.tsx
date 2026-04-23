import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StudentGrid from '@/components/StudentGrid'

describe('StudentGrid', () => {
  const students = [
    { id: 1, name: 'Airi', icon: '/icon1.png', role: 'striker' as const },
    { id: 2, name: 'Ako', icon: '/icon2.png', role: 'special' as const },
    { id: 3, name: 'Azusa', icon: '/icon3.png', role: 'striker' as const },
  ]

  it('shows all students by default', () => {
    render(
      <StudentGrid
        onSelect={vi.fn()}
        round={1}
        students={students}
      />
    )

    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTitle('Airi')).toBeInTheDocument()
    expect(screen.getByTitle('Ako')).toBeInTheDocument()
    expect(screen.getByTitle('Azusa')).toBeInTheDocument()
  })

  it('filters to striker students', () => {
    render(
      <StudentGrid
        onSelect={vi.fn()}
        round={1}
        students={students}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'ストライカー' }))

    expect(screen.getByTitle('Airi')).toBeInTheDocument()
    expect(screen.getByTitle('Azusa')).toBeInTheDocument()
    expect(screen.queryByTitle('Ako')).not.toBeInTheDocument()
  })

  it('filters to special students', () => {
    render(
      <StudentGrid
        onSelect={vi.fn()}
        round={1}
        students={students}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'スペシャル' }))

    expect(screen.getByTitle('Ako')).toBeInTheDocument()
    expect(screen.queryByTitle('Airi')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Azusa')).not.toBeInTheDocument()
  })

  it('combines search and role filters', () => {
    render(
      <StudentGrid
        onSelect={vi.fn()}
        round={1}
        students={students}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'ストライカー' }))
    fireEvent.change(screen.getByPlaceholderText('生徒名で検索...'), { target: { value: 'Azu' } })

    expect(screen.getByTitle('Azusa')).toBeInTheDocument()
    expect(screen.queryByTitle('Airi')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Ako')).not.toBeInTheDocument()
  })
})
