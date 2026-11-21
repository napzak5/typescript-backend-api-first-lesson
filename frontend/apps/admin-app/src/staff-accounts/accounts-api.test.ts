import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aStaffMember } from '../staff/components/examples'
import {
  attemptInvitation,
  changeRole,
  readAccount,
  readInvitation,
  revokeInvitation,
  unlinkAccount,
} from './accounts-api'
import { anAccount, anInvitation } from './components/examples'

/*
 * What the API answers to the accounts and the invitations is met with the
 * real API (`staff-account.integration.test.tsx`). Here are the answers a
 * test cannot bring about there.
 */

const SALON = 'salon'
const MEMBER = 'member'

/** A record as the API answers it */
const answer = (status: number, data: unknown): Response =>
  json(status, { data, meta: null, links: { self: '/' } })

type Answer = () => Response | Promise<Response>

/** Lets the API refuse an invitation, and answer the account and the member read again after it so. */
const refusing = (account: Answer, member: Answer) =>
  answering((asked) => {
    if (asked.method === 'POST') {
      return problem(409)
    }
    return new URL(asked.url).pathname.endsWith('/account')
      ? account()
      : member()
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readAccount and readInvitation', () => {
  it.each(UNREAD)('should read no account after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readAccount(SALON, MEMBER)

    // Assert
    expect(read).toEqual({ type })
  })

  it.each(UNREAD)(
    'should read no invitation after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const read = await readInvitation(SALON, MEMBER)

      // Assert
      expect(read).toEqual({ type })
    },
  )

  it('should find no account and no invitation after an ID the API does not take', async () => {
    // Arrange
    answering(() => problem(400))

    // Act
    const reads = await Promise.all([
      readAccount(SALON, MEMBER),
      readInvitation(SALON, MEMBER),
    ])

    // Assert
    expect(reads).toEqual([{ type: 'notFound' }, { type: 'notFound' }])
  })
})

describe('attemptInvitation', () => {
  it('should send the role chosen, and give the invitation the API mailed', async () => {
    // Arrange
    const sent: unknown[] = []
    answering(async (asked) => {
      sent.push(await asked.json())
      return answer(201, anInvitation())
    })

    // Act
    const attempt = await attemptInvitation(SALON, MEMBER, 'manager')

    // Assert
    expect(attempt).toEqual({ type: 'invited', invitation: anInvitation() })
    expect(sent).toEqual([{ role: 'manager' }])
  })

  it.each<[string, Answer, string]>([
    ['a body that is too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ['a role the API does not take', () => problem(400), 'failed'],
    ['a role the account may not give', () => problem(403), 'forbidden'],
    ['a member removed meanwhile', () => problem(404), 'notFound'],
    ...UNREAD,
  ])('should mail nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const attempt = await attemptInvitation(SALON, MEMBER, 'staff')

    // Assert
    expect(attempt).toEqual({ type })
  })

  it.each(UNREAD)(
    'should not tell why an invitation was refused when the account could not be read again after %s',
    async (_, given, type) => {
      // Arrange
      const fetched = answering((asked) =>
        asked.method === 'POST' ? problem(409) : given(),
      )

      // Act
      const attempt = await attemptInvitation(SALON, MEMBER, 'staff')

      // Assert
      expect(attempt).toEqual({ type })
      expect(fetched).toHaveBeenCalledTimes(2)
    },
  )

  it.each(UNREAD)(
    'should not tell why an invitation was refused when the member could not be read again after %s',
    async (_, given, type) => {
      // Arrange
      refusing(() => problem(404), given)

      // Act
      const attempt = await attemptInvitation(SALON, MEMBER, 'staff')

      // Assert
      expect(attempt).toEqual({ type })
    },
  )

  it('should take a member removed after the refusal as removed', async () => {
    // Arrange
    refusing(
      () => problem(404),
      () => problem(404),
    )

    // Act
    const attempt = await attemptInvitation(SALON, MEMBER, 'staff')

    // Assert
    expect(attempt).toEqual({ type: 'notFound' })
  })

  it('should take a refusal for an account first, as the API checks it first', async () => {
    // Arrange
    const fetched = refusing(
      () => answer(200, anAccount()),
      () => answer(200, aStaffMember({ isActive: false })),
    )

    // Act
    const attempt = await attemptInvitation(SALON, MEMBER, 'staff')

    // Assert
    expect(attempt).toEqual({ type: 'accepted', account: anAccount() })
    expect(fetched).toHaveBeenCalledTimes(2)
  })
})

describe('revokeInvitation, changeRole and unlinkAccount', () => {
  it.each<[string, () => Promise<{ type: string }>, number, string]>([
    ['a revocation', () => revokeInvitation(SALON, MEMBER), 400, 'gone'],
    [
      'a change of the role',
      () => changeRole(SALON, MEMBER, 'staff'),
      400,
      'failed',
    ],
    [
      'a change of the role',
      () => changeRole(SALON, MEMBER, 'staff'),
      413,
      'failed',
    ],
    [
      'a change of the role',
      () => changeRole(SALON, MEMBER, 'staff'),
      409,
      'own',
    ],
    [
      'a change of the role',
      () => changeRole(SALON, MEMBER, 'owner'),
      403,
      'forbidden',
    ],
    ['an unlinking', () => unlinkAccount(SALON, MEMBER), 409, 'own'],
    ['an unlinking', () => unlinkAccount(SALON, MEMBER), 400, 'gone'],
  ])(
    'should take %s refused with %d as %s',
    async (_, attempt, status, type) => {
      // Arrange
      answering(() => problem(status))

      // Act
      const outcome = await attempt()

      // Assert
      expect(outcome).toEqual({ type })
    },
  )

  it.each(UNREAD)('should change nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const outcomes = await Promise.all([
      revokeInvitation(SALON, MEMBER),
      changeRole(SALON, MEMBER, 'staff'),
      unlinkAccount(SALON, MEMBER),
    ])

    // Assert
    expect(outcomes).toEqual([{ type }, { type }, { type }])
  })
})
