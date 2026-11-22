import {
  answering,
  page,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../bookings/components/examples'
import { colourLot, MOVEMENTS_OF_THE_LOT } from './components/examples'
import {
  movementsKeyOf,
  readMovementPage,
  recordMovement,
} from './movements-api'

/*
 * What the API answers to the movements is met with the real API
 * (`movements.integration.test.tsx`). Here are the answers a test cannot
 * bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('movementsKeyOf', () => {
  it('should read the movements below the row, so that dropping the row drops them', () => {
    expect(movementsKeyOf(colourLot.id)).toEqual([
      'inventory',
      colourLot.id,
      'movements',
    ])
  })
})

describe('readMovementPage', () => {
  it('should ask for a page of the movements of a kind and of days at the salon, after the cursor', async () => {
    // Arrange
    const fetched = answering(() => page(MOVEMENTS_OF_THE_LOT))

    // Act
    const read = await readMovementPage(
      colourLot.id,
      { type: 'use', from: '2026-11-01', to: '2026-11-30' },
      salon.timezone,
      'a1b2c3d4-0003-4e6f-8a7b-9c0d1e2f3a4b',
    )

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: MOVEMENTS_OF_THE_LOT,
      total: 5,
      nextCursor: null,
    })
    expect(
      fetched.mock.calls.map(([asked]) => {
        const url = new URL(new Request(asked).url)

        return [url.pathname, Object.fromEntries(url.searchParams)]
      }),
    ).toEqual([
      [
        `/api/v1/inventory/${colourLot.id}/movements`,
        {
          transactionType: 'use',
          startDate: '2026-10-31T15:00:00.000Z',
          endDate: '2026-11-30T14:59:59.999Z',
          cursor: 'a1b2c3d4-0003-4e6f-8a7b-9c0d1e2f3a4b',
          limit: '20',
        },
      ],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a row that is none', () => problem(404), 'notFound'],
    ['the account', () => problem(403), 'forbidden'],
    [
      'a cursor that names a movement of another row',
      () => problem(400),
      'failed',
    ],
    ...UNREAD,
  ])('should read no page after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readMovementPage(
      colourLot.id,
      {},
      salon.timezone,
      undefined,
    )

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('recordMovement', () => {
  it.each<[string, Answer, string]>([
    [
      'the row removed meanwhile',
      () => problem(400, [{ field: 'inventoryId', rule: 'not_found' }]),
      'notFound',
    ],
    [
      'a refusal of a kind the account does not record',
      () => problem(403),
      'forbidden',
    ],
    ['a body that is too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should record no movement after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const recorded = await recordMovement({
      inventoryId: colourLot.id,
      transactionType: 'use',
      quantity: -1,
      unitCost: null,
      referenceType: null,
      referenceId: null,
      reason: null,
    })

    // Assert
    expect(recorded).toEqual({ type })
  })
})
