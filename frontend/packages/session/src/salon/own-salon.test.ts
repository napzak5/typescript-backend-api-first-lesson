import type { ModelsUserRoleType } from '@beauty-salon-frontend/api-client'
import {
  answering,
  asked,
  problem,
  record,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readOwnSalon, worksAtSalon } from './own-salon'

/*
 * The answers the real API gives are met in the screen tests of the
 * applications that use the salon. Here are the ones a test cannot bring
 * about there: too many requests, an error of the server, no answer, a
 * status the contract does not name.
 */

const SALON_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'

const profile = {
  id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c02',
  salonId: SALON_ID,
  displayName: '田中 美咲',
  level: 'senior',
  position: null,
  specialties: [],
  bio: null,
  imageUrl: null,
  yearsOfExperience: null,
  certifications: [],
  canReceiveBookings: true,
}

describe('worksAtSalon', () => {
  it.each<[ModelsUserRoleType | undefined, boolean]>([
    ['owner', true],
    ['manager', true],
    ['staff', true],
    ['admin', false],
    ['customer', false],
    [undefined, false],
  ])(
    'should say of the role %s whether it is one of a salon: %s',
    (role, works) => {
      // Act, Assert
      expect(worksAtSalon(role)).toBe(works)
    },
  )
})

describe('readOwnSalon', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should give the salon of the member of the staff the account is linked to', async () => {
    // Arrange
    const fetched = answering(() => record(200, profile))

    // Act
    const read = await readOwnSalon()

    // Assert
    expect(read).toEqual({ type: 'member', salonId: SALON_ID })
    expect(asked(fetched)).toEqual(['GET /staff-profiles/me'])
  })

  it.each([
    ['no salon reaches the account', 403],
    ['the member of the staff is gone', 404],
  ])('should say that there is no salon when %s', async (_case, status) => {
    // Arrange
    answering(() => problem(status))

    // Act, Assert
    expect(await readOwnSalon()).toEqual({ type: 'none' })
  })

  it('should say that there were too many requests', async () => {
    // Arrange
    answering(() => problem(429))

    // Act, Assert
    expect(await readOwnSalon()).toEqual({ type: 'tooManyRequests' })
  })

  it.each([
    ['an error of the server', () => problem(500)],
    ['a session that could not be renewed', () => problem(401)],
    ['a status the contract does not name', () => problem(502)],
    ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('should fail on %s', async (_case, answer) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await readOwnSalon()).toEqual({ type: 'failed' })
  })
})
