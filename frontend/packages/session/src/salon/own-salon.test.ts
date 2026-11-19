import { afterEach, describe, expect, it, vi } from 'vitest'
import { readOwnSalon } from './own-salon'

/*
 * The answers the real API gives are met in the screen tests of the
 * applications that use the salon. Here are the ones a test cannot bring
 * about there: too many requests, an error of the server, no answer, a
 * status the contract does not name.
 */

const SALON_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': `${type}; charset=utf-8` },
  })

const problem = (status: number) =>
  json(
    status,
    {
      type: 'urn:beauty-salon:problem',
      title: 'Problem',
      status,
      detail: null,
      instance: null,
      code: '2001',
      errors: null,
      correlationId: null,
      timestamp: '2026-11-20T00:00:00.000Z',
    },
    'application/problem+json',
  )

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

/** Lets the API answer every request with what `answer` returns. */
const answering = (answer: () => Response | Promise<Response>) => {
  const fetched = vi.fn<typeof fetch>(async () => answer())
  vi.stubGlobal('fetch', fetched)

  return fetched
}

describe('readOwnSalon', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should give the salon of the member of the staff the account is linked to', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: profile,
        meta: null,
        links: { self: '/api/v1/staff-profiles/me' },
      }),
    )

    // Act
    const read = await readOwnSalon()

    // Assert
    expect(read).toEqual({ type: 'member', salonId: SALON_ID })
    expect(String(fetched.mock.calls[0]?.[0])).toBe(
      'http://localhost:3000/api/v1/staff-profiles/me',
    )
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
