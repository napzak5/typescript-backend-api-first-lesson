import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { salon } from '../bookings/components/examples'
import {
  findSalons,
  readSalon,
  readServices,
  readStaffProfiles,
} from './salons-api'

/*
 * The answers the real API gives are met in the screen tests. Here are
 * those a test cannot bring about there, and what the reads ask for.
 */

const READS: [string, () => Promise<{ type: string }>][] = [
  ['findSalons', () => findSalons(undefined, undefined)],
  ['readSalon', () => readSalon(salon.id)],
  ['readStaffProfiles', () => readStaffProfiles(salon.id)],
  ['readServices', () => readServices(salon.id)],
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
    await findSalons('表参道', salon.id)

    // Assert
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      keyword: '表参道',
      cursor: salon.id,
      limit: '20',
    })
  })

  it('should read the staff and the services of a salon in the largest pages', async () => {
    // Arrange
    const fetched = answering(() => json(200, EMPTY_PAGE))

    // Act
    await readStaffProfiles(salon.id)
    await readServices(salon.id)

    // Assert
    const [staff, services] = fetched.mock.calls.map(
      ([input]) => new URL(String(input)),
    )
    expect(Object.fromEntries(staff?.searchParams ?? [])).toEqual({
      salonId: salon.id,
      limit: '100',
    })
    expect(services?.pathname).toBe(`/api/v1/salons/${salon.id}/services`)
    expect(Object.fromEntries(services?.searchParams ?? [])).toEqual({
      limit: '100',
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
