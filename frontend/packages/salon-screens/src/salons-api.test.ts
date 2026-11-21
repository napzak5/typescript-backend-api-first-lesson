import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findSalons, readSalon } from './salons-api'

/*
 * The answers the real API gives are met in the screen tests. Here are
 * those a test cannot bring about there, and what the reads ask for.
 */

/** A salon: any ID will do, the API is not called */
const SALON_ID = '0b9a4d0e-5c1f-4c3e-9d6a-2f7b8e1a3c55'

const READS: [string, () => Promise<{ type: string }>][] = [
  ['findSalons', () => findSalons(undefined, undefined)],
  ['readSalon', () => readSalon(SALON_ID)],
]

const EMPTY_PAGE = {
  data: [],
  meta: { total: 0, nextCursor: null },
  links: { self: '/' },
}

describe('the reads of salons', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(READS)('%s', (_name, read) => {
    it.each(UNREAD)(
      'should say why nothing came of %s',
      async (_case, answer, type) => {
        // Arrange
        answering(answer)

        // Act, Assert
        expect(await read()).toEqual({ type })
      },
    )
  })

  it('should look for salons whatever they take, with the keyword, 20 at a time', async () => {
    // Arrange
    const fetched = answering(() => json(200, EMPTY_PAGE))

    // Act
    await findSalons('表参道', SALON_ID)

    // Assert
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      keyword: '表参道',
      cursor: SALON_ID,
      limit: '20',
    })
  })

  it('should not ask for a salon whose address holds no ID', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act, Assert
    expect(await readSalon('omotesando')).toEqual({ type: 'notFound' })
    expect(fetched).not.toHaveBeenCalled()
  })
})
