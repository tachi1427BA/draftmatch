import { describe, expect, test, vi } from 'vitest'
import { fetchStudents } from '@/lib/studentLoader'

describe('studentLoader', () => {
  test('maps spreadsheet positions 0/1 to striker/special and builds icon paths', async () => {
    const csv = `Id,Name,EXCost,Position(Striker =0 Spetial=1),Icon\n1,アイリ,5,1,cicon_001\n2,アカネ,2,0,cicon_002`

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(csv),
    })))

    const students = await fetchStudents()

    expect(students).toEqual([
      {
        id: 1,
        name: 'アイリ',
        icon: '/CharacterIcon/cicon_001.png',
        role: 'special',
      },
      {
        id: 2,
        name: 'アカネ',
        icon: '/CharacterIcon/cicon_002.png',
        role: 'striker',
      },
    ])
  })
})
