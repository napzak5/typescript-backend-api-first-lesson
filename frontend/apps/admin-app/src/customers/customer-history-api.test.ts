import { answering, json, UNREAD } from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aCustomer } from '../bookings/components/examples'
import {
  readHistoryPage,
  readRemoved,
  readVersion,
  removeCustomer,
  restoreCustomer,
} from './customer-history-api'

/*
 * What the history, the versions, the removal and the restore do with the
 * answers of the real API is met in `customer-history.integration.test.tsx`.
 * Here are the answers a test cannot bring about there.
 */

const { id } = aCustomer()

describe('readHistoryPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readHistoryPage(id, undefined)).toEqual({ type })
    },
  )
})

describe('readVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readVersion(id, '2')).toEqual({ type })
    },
  )

  it.each<[string, string, string]>([
    ['no ID', 'yamada', '2'],
    ['no number', id, 'latest'],
    ['the number nought', id, '0'],
    ['a number written with a nought before it', id, '02'],
    ['a number that is no whole one', id, '1.5'],
    ['a number above the largest', id, '2147483648'],
    ['nothing', id, ''],
  ])('should not ask for what has %s', async (_case, customerId, version) => {
    // Arrange
    const fetched = answering(() => json(500, null))

    // Act, Assert
    expect(await readVersion(customerId, version)).toEqual({
      type: 'notFound',
    })
    expect(fetched).not.toHaveBeenCalled()
  })

  it('should ask for the largest number a version may have', async () => {
    // Arrange
    const fetched = answering(() => json(500, null))

    // Act
    await readVersion(id, '2147483647')

    // Assert
    expect(new URL(String(fetched.mock.calls[0]?.[0])).pathname).toBe(
      `/api/v1/customers/${id}/versions/2147483647`,
    )
  })
})

describe('readRemoved', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readRemoved(id)).toEqual({ type })
    },
  )

  it('should not ask for what is no ID', async () => {
    // Arrange
    const fetched = answering(() => json(500, null))

    // Act, Assert
    expect(await readRemoved('yamada')).toEqual({ type: 'notFound' })
    expect(fetched).not.toHaveBeenCalled()
  })

  it('should take a history without a version for a customer who is not there', async () => {
    // Arrange
    answering(() =>
      json(200, {
        data: [],
        meta: { total: 0, nextCursor: null, prevCursor: null },
        links: { self: `/api/v1/customers/${id}/history` },
      }),
    )

    // Act, Assert
    expect(await readRemoved(id)).toEqual({ type: 'notFound' })
  })
})

describe('removeCustomer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await removeCustomer(id)).toEqual({ type })
    },
  )
})

describe('restoreCustomer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await restoreCustomer(id)).toEqual({ type })
    },
  )
})
