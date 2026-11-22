import type { ModelsStaffCreateRequest } from '@beauty-salon-frontend/api-client'
import {
  answering,
  page,
  problem,
  problemWithCode,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../bookings/components/examples'
import { aNewMember, aStaffMember } from './components/examples'
import {
  attemptStaffChange,
  attemptStaffEntry,
  readStaffMember,
  readStaffPage,
  removeStaffMember,
} from './staff-api'

/*
 * What the API answers to the staff ledger is met with the real API
 * (`staff.integration.test.tsx`). Here are the answers a test cannot bring
 * about there.
 */

const member = aStaffMember()

const {
  id: _id,
  salonId: _salonId,
  userId: _userId,
  createdAt: _c,
  updatedAt: _u,
  ...fields
} = member

const request: ModelsStaffCreateRequest = fields

const TAKEN = '3002'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readStaffPage', () => {
  it.each<[string, () => Response]>([
    ['400', () => problem(400)],
    ['404', () => problem(404)],
  ])('should read nothing after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readStaffPage(salon.id, undefined)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readStaffPage(salon.id, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readStaffMember', () => {
  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readStaffMember(salon.id, member.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('attemptStaffEntry', () => {
  it('should read the ledger to its end in its largest pages, and find the address of mail taken by a member there', async () => {
    // Arrange
    const first = aNewMember()
    const fetched = answering((asked) =>
      asked.method === 'POST'
        ? problemWithCode(409, TAKEN)
        : new URL(asked.url).searchParams.has('cursor')
          ? page([member])
          : page([first], first.id),
    )

    // Act
    const attempt = await attemptStaffEntry(salon.id, {
      ...request,
      email: 'Misaki.Tanaka@Example.com',
    })

    // Assert
    expect(attempt).toEqual({ type: 'duplicate', field: 'email' })
    expect(
      fetched.mock.calls
        .map(([asked, init]) => new Request(asked, init))
        .filter(({ method }) => method === 'GET')
        .map(({ url }) => Object.fromEntries(new URL(url).searchParams)),
    ).toEqual([{ limit: '100' }, { cursor: first.id, limit: '100' }])
  })

  it('should take the address of mail as taken without reading the ledger when no staff code was sent', async () => {
    // Arrange
    const fetched = answering(() => problemWithCode(409, TAKEN))

    // Act
    const attempt = await attemptStaffEntry(salon.id, {
      ...request,
      staffCode: null,
    })

    // Assert
    expect(attempt).toEqual({ type: 'duplicate', field: 'email' })
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it.each<[string, () => Response, string]>([
    ['too many requests', () => problem(429), 'tooManyRequests'],
    ['a refusal of the account', () => problem(403), 'forbidden'],
    ['an error of the server', () => problem(500), 'failed'],
  ])(
    'should not say which value is taken when the ledger could not be read after %s',
    async (_, answer, type) => {
      // Arrange
      answering((asked) =>
        asked.method === 'POST' ? problemWithCode(409, TAKEN) : answer(),
      )

      // Act
      const attempt = await attemptStaffEntry(salon.id, request)

      // Assert
      expect(attempt).toEqual({ type })
    },
  )

  it.each<[string, () => Response]>([
    ['a salon removed meanwhile', () => problem(404)],
    ['a body too large', () => problem(413)],
    ['a body of another type', () => problem(415)],
  ])('should fail after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const attempt = await attemptStaffEntry(salon.id, request)

    // Assert
    expect(attempt).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should fail after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const attempt = await attemptStaffEntry(salon.id, request)

    // Assert
    expect(attempt).toEqual({ type })
  })
})

describe('attemptStaffChange', () => {
  it('should take the staff code as taken without reading the ledger when no address of mail was sent', async () => {
    // Arrange
    const fetched = answering(() => problemWithCode(409, TAKEN))

    // Act
    const attempt = await attemptStaffChange(salon.id, member.id, {
      staffCode: 'STF002',
    })

    // Assert
    expect(attempt).toEqual({ type: 'duplicate', field: 'staffCode' })
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('should not take the address of mail of the member being changed as taken by another', async () => {
    // Arrange
    answering((asked) =>
      asked.method === 'PATCH' ? problemWithCode(409, TAKEN) : page([member]),
    )

    // Act
    const attempt = await attemptStaffChange(salon.id, member.id, {
      email: member.email,
      staffCode: 'STF002',
    })

    // Assert
    expect(attempt).toEqual({ type: 'duplicate', field: 'staffCode' })
  })

  it.each<[string, () => Response]>([
    ['a body too large', () => problem(413)],
    ['a body of another type', () => problem(415)],
  ])('should fail after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const attempt = await attemptStaffChange(salon.id, member.id, {
      isActive: false,
    })

    // Assert
    expect(attempt).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should fail after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const attempt = await attemptStaffChange(salon.id, member.id, {
      isActive: false,
    })

    // Assert
    expect(attempt).toEqual({ type })
  })
})

describe('removeStaffMember', () => {
  it('should fail after 400', async () => {
    // Arrange
    answering(() => problem(400))

    // Act
    const removal = await removeStaffMember(salon.id, member.id)

    // Assert
    expect(removal).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should fail after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const removal = await removeStaffMember(salon.id, member.id)

    // Assert
    expect(removal).toEqual({ type })
  })
})
