import {
  answering,
  asked,
  json,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../bookings/components/examples'
import { readServices, readStaffProfiles } from './salons-api'

/*
 * The answers the real API gives are met in the screen tests. Here are
 * those a test cannot bring about there, and what the reads ask for.
 */

const READS: [string, () => Promise<{ type: string }>][] = [
  ['readStaffProfiles', () => readStaffProfiles(salon.id)],
  ['readServices', () => readServices(salon.id)],
]

const EMPTY_PAGE = {
  data: [],
  meta: { total: 0, nextCursor: null },
  links: { self: '/' },
}

describe('the reads of the names of a salon', () => {
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

  it('should read the staff and the services of a salon in the largest pages', async () => {
    // Arrange
    const fetched = answering(() => json(200, EMPTY_PAGE))

    // Act
    await readStaffProfiles(salon.id)
    await readServices(salon.id)

    // Assert
    expect(asked(fetched)).toEqual([
      `GET /staff-profiles?limit=100&salonId=${salon.id}`,
      `GET /salons/${salon.id}/services?limit=100`,
    ])
  })
})
