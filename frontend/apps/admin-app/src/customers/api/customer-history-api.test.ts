import {
  answering,
  asked,
  json,
  page,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aCustomer } from '../../bookings/components/examples'
import { history } from '../components/examples'
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

  it.each([
    ['a refusal of the account', () => problem(403)],
    ['a customer who is not in the ledger', () => problem(404)],
  ])('should say that it failed after %s', async (_case, answer) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await readHistoryPage(id, undefined)).toEqual({ type: 'failed' })
  })
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

  it('should say that the account may not read the version', async () => {
    // Arrange
    answering(() => problem(403))

    // Act, Assert
    expect(await readVersion(id, '2')).toEqual({ type: 'forbidden' })
  })

  it('should ask for the largest number a version may have', async () => {
    // Arrange
    const fetched = answering(() => json(500, null))

    // Act
    await readVersion(id, '2147483647')

    // Assert
    expect(asked(fetched)).toEqual([`GET /customers/${id}/versions/2147483647`])
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

  it('should say that the account may not read the history', async () => {
    // Arrange
    answering(() => problem(403))

    // Act, Assert
    expect(await readRemoved(id)).toEqual({ type: 'forbidden' })
  })

  it.each(UNREAD)(
    'should say why nothing came of the version of the removal: %s',
    async (_case, answer, type) => {
      // Arrange
      answering((request) =>
        new URL(request.url).pathname.endsWith('/history')
          ? page(
              history
                .slice(0, 1)
                .map((entry) => ({ ...entry, operation: 'delete' })),
            )
          : answer(),
      )

      // Act, Assert
      expect(await readRemoved(id)).toEqual({ type })
    },
  )

  it('should take a history without a version for a customer who is not there', async () => {
    // Arrange
    answering(() => page([]))

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

  it('should say that the account may not remove the customer', async () => {
    // Arrange
    answering(() => problem(403))

    // Act, Assert
    expect(await removeCustomer(id)).toEqual({ type: 'forbidden' })
  })
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

  it.each([
    ['a customer who is not there', () => problem(404), 'notFound'],
    ['a refusal of the account', () => problem(403), 'forbidden'],
  ])('should say what came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await restoreCustomer(id)).toEqual({ type })
  })
})
