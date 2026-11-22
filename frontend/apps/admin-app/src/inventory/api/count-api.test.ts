import {
  answering,
  asked,
  problem,
  record,
  sent,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../bookings/components/examples'
import {
  COUNT_OF_THE_SALON,
  expiredColour,
  shampooRow,
  VALUE_OF_THE_SALON,
} from '../components/examples'
import { countStock, readValueReport, valueReportKeyOf } from './count-api'

/*
 * What the API answers to a count and to the value of the stock is met
 * with the real API (`count.integration.test.tsx`). Here are the answers a
 * test cannot bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

const COUNT = {
  salonId: salon.id,
  items: [
    { inventoryId: expiredColour.id, countedQuantity: 2 },
    { inventoryId: shampooRow.id, countedQuantity: 9 },
  ],
  reason: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('countStock', () => {
  it('should send the count, and hand over the rows that differed', async () => {
    // Arrange
    const fetched = answering(() => record(200, COUNT_OF_THE_SALON))

    // Act
    const counted = await countStock(COUNT)

    // Assert
    expect(counted).toEqual({ type: 'counted', result: COUNT_OF_THE_SALON })
    expect(asked(fetched)).toEqual(['POST /inventory/stock-count'])
    expect(await sent(fetched)).toEqual([COUNT])
  })

  it.each<[string, Answer, unknown]>([
    [
      'a row that is no longer among those of the salon',
      () =>
        problem(400, [
          { field: 'items.0.countedQuantity', rule: 'too_big' },
          { field: 'items.1.inventoryId', rule: 'not_found' },
        ]),
      { type: 'rowsChanged' },
    ],
    [
      'values the API does not take',
      () => problem(400, [{ field: 'reason', rule: 'too_big' }]),
      { type: 'invalid', values: [{ field: 'reason', rule: 'too_big' }] },
    ],
    ['stock reserved meanwhile', () => problem(409), { type: 'belowReserved' }],
    ['the account', () => problem(403), { type: 'forbidden' }],
    ['a body that is too large', () => problem(413), { type: 'failed' }],
    ['a body of another type', () => problem(415), { type: 'failed' }],
    ...UNREAD.map(([name, answer, type]): [string, Answer, unknown] => [
      name,
      answer,
      { type },
    ]),
  ])('should record no count after %s', async (_, given, outcome) => {
    // Arrange
    answering(given)

    // Act
    const counted = await countStock(COUNT)

    // Assert
    expect(counted).toEqual(outcome)
  })
})

describe('valueReportKeyOf', () => {
  it('should read the value below the stock of the salon, so that a movement or a count drops it', () => {
    expect(valueReportKeyOf(salon.id)).toEqual([
      'salons',
      salon.id,
      'inventory',
      'value',
    ])
  })
})

describe('readValueReport', () => {
  it('should ask for the value of the stock of the salon', async () => {
    // Arrange
    const fetched = answering(() => record(200, VALUE_OF_THE_SALON))

    // Act
    const read = await readValueReport(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', report: VALUE_OF_THE_SALON })
    expect(asked(fetched)).toEqual([
      `GET /inventory/value-report?salonId=${salon.id}`,
    ])
  })

  it.each<[string, Answer, string]>([
    ['the account', () => problem(403), 'forbidden'],
    ['a salon removed meanwhile', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no value after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readValueReport(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})
