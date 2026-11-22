import {
  answering,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aCustomer } from '../../bookings/components/examples'
import type { PointRecording } from '../utils/points'
import {
  readBalance,
  readExpiring,
  readTransactionsPage,
  recordPoints,
} from './points-api'

/*
 * What the screens of the points do with the answers of the real API is
 * met in `customer-points.integration.test.tsx`. Here are the answers a
 * test cannot bring about there.
 */

const { id } = aCustomer()

describe('readBalance', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readBalance(id)).toEqual({ type })
    },
  )

  it('should not ask for the balance of what is no ID', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act, Assert
    expect(await readBalance('yamada')).toEqual({ type: 'failed' })
    expect(fetched).not.toHaveBeenCalled()
  })
})

describe('readExpiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readExpiring(id)).toEqual({ type })
    },
  )
})

describe('readTransactionsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readTransactionsPage(id, undefined)).toEqual({ type })
    },
  )
})

const POINTS_GIVEN: PointRecording = {
  type: 'earn',
  request: {
    customerId: id,
    points: 500,
    description: null,
    referenceType: null,
    referenceId: null,
    expiryDate: null,
  },
}

describe('recordPoints', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should say that the account may not record what it sent', async () => {
    // Arrange
    answering(() => problem(403))

    // Act, Assert
    expect(await recordPoints(POINTS_GIVEN)).toEqual({ type: 'forbidden' })
  })

  it.each([
    ...UNREAD,
    ['a body too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await recordPoints(POINTS_GIVEN)).toEqual({ type })
  })
})
