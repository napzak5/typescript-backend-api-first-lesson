import {
  answering,
  problem,
  record,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aLockedUser, aUser } from './components/examples'
import {
  readUser,
  resetTwoFactor,
  unlockAccount,
  userKeyOf,
} from './user-accounts-api'

/*
 * What the API answers to the accounts is met with the real API
 * (`user-accounts.integration.test.tsx`). Here are the answers a test
 * cannot bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The methods, the paths and the bodies of the requests that were sent */
const askedOf = (fetched: ReturnType<typeof answering>) =>
  Promise.all(
    fetched.mock.calls.map(async ([asked, init]) => {
      const request = new Request(asked, init)
      const body = await request.text()

      return [
        request.method,
        new URL(request.url).pathname,
        body === '' ? null : JSON.parse(body),
      ]
    }),
  )

const user = aUser()

describe('userKeyOf', () => {
  it('should read an account under its ID', () => {
    expect(userKeyOf(user.id)).toEqual(['user', user.id])
  })
})

describe('readUser', () => {
  it('should read the account by its ID', async () => {
    // Arrange
    const fetched = answering(() => record(200, user))

    // Act
    const read = await readUser(user.id)

    // Assert
    expect(read).toEqual({ type: 'found', user })
    expect(await askedOf(fetched)).toEqual([
      ['GET', `/api/v1/admin/auth/users/${user.id}`, null],
    ])
  })

  it.each<[string, Answer, string]>([
    ['an ID that is none', () => problem(400), 'notFound'],
    ['an account that is not there', () => problem(404), 'notFound'],
    [
      'an account that is not an administrator',
      () => problem(403),
      'forbidden',
    ],
    ...UNREAD,
  ])('should read no account after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readUser(user.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('unlockAccount', () => {
  it('should lift the lock of the account by its ID, and hand over the account as it is now', async () => {
    // Arrange
    const fetched = answering(() => record(200, user))

    // Act
    const unlocking = await unlockAccount(aLockedUser().id)

    // Assert
    expect(unlocking).toEqual({ type: 'unlocked', user })
    expect(await askedOf(fetched)).toEqual([
      ['POST', `/api/v1/admin/auth/unlock/${user.id}`, null],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a lock that ran out meanwhile', () => problem(409), 'notLocked'],
    ['an account deleted meanwhile', () => problem(404), 'notFound'],
    ['the account of the session', () => problem(403), 'forbidden'],
    ['an ID that is none', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should lift no lock after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const unlocking = await unlockAccount(user.id)

    // Assert
    expect(unlocking).toEqual({ type })
  })
})

describe('resetTwoFactor', () => {
  it('should reset the second factor of the account by its ID, and hand over the account as it is now', async () => {
    // Arrange
    const changed = aUser({ twoFactorStatus: 'disabled' })
    const fetched = answering(() => record(200, changed))

    // Act
    const reset = await resetTwoFactor(user.id)

    // Assert
    expect(reset).toEqual({ type: 'reset', user: changed })
    expect(await askedOf(fetched)).toEqual([
      ['POST', `/api/v1/admin/auth/reset-two-factor/${user.id}`, null],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a second factor turned off meanwhile', () => problem(409), 'notEnabled'],
    ['an account deleted meanwhile', () => problem(404), 'notFound'],
    ['the account of the session', () => problem(403), 'forbidden'],
    ['an ID that is none', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should reset nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const reset = await resetTwoFactor(user.id)

    // Assert
    expect(reset).toEqual({ type })
  })
})
