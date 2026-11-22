import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { BOOKING_ID } from '../../__tests__/fixtures/booking-fixtures'
import {
  apiPointTransaction,
  dbPointTransaction,
  OTHER_POINT_TRANSACTION_ID,
  POINT_TRANSACTION_ID,
  pointAdjustRequest,
  pointEarnRequest,
  pointUseRequest,
} from '../../__tests__/fixtures/point-fixtures'
import { customerIdSchema } from '../../models/customer'
import {
  type ApiPointExpiringSearchRequest,
  pointTransactionIdSchema,
} from '../../models/point'
import {
  pointAdjustRequestSchema,
  pointEarnRequestSchema,
  pointExpireRequestSchema,
  pointTransactionSearchRequestSchema,
  pointUseRequestSchema,
} from '../../schemas/point.schema'
import { PointReadMapper } from '../read/point.mapper'
import { PointWriteMapper } from '../write/point.mapper'

const customerId = customerIdSchema.parse(CUSTOMER_ID)

/** What a stored point transaction that does not fit the model is answered with. */
const storedRowIsCorrupt = (id: string) => ({
  type: 'error',
  error: expect.objectContaining({
    type: 'database',
    message: `Stored point transaction ${id} does not match the API model`,
  }),
})

describe('PointReadMapper.toApiPointTransaction', () => {
  it('returns every column under its own name, the time in ISO 8601', () => {
    expect(PointReadMapper.toApiPointTransaction(dbPointTransaction())).toEqual(
      { type: 'success', data: apiPointTransaction() },
    )
  })

  it('returns a transaction without a record and without an expiry date', () => {
    const transaction = dbPointTransaction({
      transactionType: 'used',
      points: -500,
      balance: 0,
      description: null,
      referenceType: null,
      referenceId: null,
      expiryDate: null,
    })

    expect(PointReadMapper.toApiPointTransaction(transaction)).toEqual({
      type: 'success',
      data: apiPointTransaction({
        transactionType: 'used',
        points: -500,
        balance: 0,
        description: null,
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      }),
    })
  })

  it('returns a booking as the record', () => {
    expect(
      PointReadMapper.toApiPointTransaction(
        dbPointTransaction({
          referenceType: 'booking',
          referenceId: BOOKING_ID,
        }),
      ),
    ).toEqual({
      type: 'success',
      data: apiPointTransaction({
        referenceType: 'booking',
        referenceId: BOOKING_ID,
      }),
    })
  })

  it('reports a kind of record that the API does not know', () => {
    expect(
      PointReadMapper.toApiPointTransaction(
        dbPointTransaction({ referenceType: 'payment' }),
      ),
    ).toEqual({
      type: 'error',
      error: expect.objectContaining({
        type: 'database',
        message: `Stored point transaction ${POINT_TRANSACTION_ID} does not match the API model`,
      }),
    })
  })

  it('reports a time that is not one', () => {
    expect(
      PointReadMapper.toApiPointTransaction(
        dbPointTransaction({ createdAt: 'then' }),
      ),
    ).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('PointReadMapper.toApiPointTransactions', () => {
  it('returns the transactions in their order', () => {
    expect(
      PointReadMapper.toApiPointTransactions([
        dbPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
        dbPointTransaction(),
      ]),
    ).toEqual({
      type: 'success',
      data: [
        apiPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
        apiPointTransaction(),
      ],
    })
  })

  it('returns no transaction', () => {
    expect(PointReadMapper.toApiPointTransactions([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('reports the first transaction that does not fit the model', () => {
    expect(
      PointReadMapper.toApiPointTransactions([
        dbPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
        dbPointTransaction({ referenceType: 'payment' }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored point transaction ${POINT_TRANSACTION_ID} does not match the API model`,
      },
    })
  })
})

describe('PointReadMapper.toApiPointTransactionPage', () => {
  const paging = {
    limit: 2,
    after: pointTransactionIdSchema.parse(POINT_TRANSACTION_ID),
  }

  it('answers with the point transactions, the counts of the list and the place of the page', () => {
    expect(
      PointReadMapper.toApiPointTransactionPage(
        {
          type: 'listed',
          transactions: [
            dbPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
            dbPointTransaction(),
          ],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toEqual({
      type: 'success',
      data: {
        data: [
          apiPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
          apiPointTransaction(),
        ],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: POINT_TRANSACTION_ID,
          nextCursor: POINT_TRANSACTION_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      PointReadMapper.toApiPointTransactionPage(
        {
          type: 'listed',
          transactions: [dbPointTransaction()],
          total: 1,
          hasMore: false,
        },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
  })

  it('reports the first point transaction whose stored row is at fault', () => {
    expect(
      PointReadMapper.toApiPointTransactionPage(
        {
          type: 'listed',
          transactions: [
            dbPointTransaction(),
            dbPointTransaction({
              id: OTHER_POINT_TRANSACTION_ID,
              createdAt: 'then',
            }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toEqual(storedRowIsCorrupt(OTHER_POINT_TRANSACTION_ID))
  })
})

describe('PointReadMapper.toApiPointBalance', () => {
  it.each<[string, number]>([
    ['the points they have', 2620],
    ['no points', 0],
  ])('answers with the customer and %s', (_named, balance) => {
    expect(
      PointReadMapper.toApiPointBalance(customerId, balance),
    ).toStrictEqual({ customerId: CUSTOMER_ID, balance })
  })
})

describe('PointReadMapper.toApiExpiringPoints', () => {
  it('answers with what is left, the earliest expiry date and the earnings in their order', () => {
    expect(
      PointReadMapper.toApiExpiringPoints(customerId, {
        expiringPoints: 150,
        expirationDate: '2026-11-30',
        transactions: [
          dbPointTransaction({
            id: OTHER_POINT_TRANSACTION_ID,
            expiryDate: '2026-11-30',
          }),
          dbPointTransaction(),
        ],
      }),
    ).toStrictEqual({
      type: 'success',
      data: {
        customerId: CUSTOMER_ID,
        expiringPoints: 150,
        expirationDate: '2026-11-30',
        transactions: [
          apiPointTransaction({
            id: OTHER_POINT_TRANSACTION_ID,
            expiryDate: '2026-11-30',
          }),
          apiPointTransaction(),
        ],
      },
    })
  })

  it('answers with no points and no date when nothing is expiring', () => {
    expect(
      PointReadMapper.toApiExpiringPoints(customerId, {
        expiringPoints: 0,
        expirationDate: null,
        transactions: [],
      }),
    ).toStrictEqual({
      type: 'success',
      data: {
        customerId: CUSTOMER_ID,
        expiringPoints: 0,
        expirationDate: null,
        transactions: [],
      },
    })
  })

  it('reports an earning whose stored row is at fault', () => {
    expect(
      PointReadMapper.toApiExpiringPoints(customerId, {
        expiringPoints: 120,
        expirationDate: '2027-11-30',
        transactions: [dbPointTransaction({ referenceType: 'payment' })],
      }),
    ).toEqual(storedRowIsCorrupt(POINT_TRANSACTION_ID))
  })
})

describe('PointReadMapper.toApiPointExpiry', () => {
  it.each<[string, number, number]>([
    ['the customers it expired points of and the points it took', 3, 450],
    ['nothing when no point had lapsed', 0, 0],
  ])(
    'answers with %s, and with nothing else',
    (_named, processedCount, totalPoints) => {
      expect(
        PointReadMapper.toApiPointExpiry({
          type: 'expired',
          processedCount,
          totalPoints,
        }),
      ).toStrictEqual({ processedCount, totalPoints })
    },
  )
})

describe('PointWriteMapper', () => {
  it('returns an earn request as the earning of the points it names, with the day they lapse', () => {
    const request = pointEarnRequestSchema.parse(pointEarnRequest())

    expect(PointWriteMapper.fromEarnRequest(request)).toStrictEqual({
      type: 'earned',
      request: {
        customerId: CUSTOMER_ID,
        points: 120,
        description: 'お会計 12,650 円',
        referenceType: 'sale',
        referenceId: request.referenceId,
        expiryDate: '2027-11-30',
      },
    })
  })

  it('returns a use request as the use of the points it names', () => {
    const request = pointUseRequestSchema.parse(pointUseRequest())

    expect(PointWriteMapper.fromUseRequest(request)).toStrictEqual({
      type: 'used',
      request,
    })
  })

  it.each<[string, number]>([
    ['takes points away', -300],
    ['gives points', 300],
  ])('returns an adjust request that %s as an adjustment', (_named, points) => {
    const request = pointAdjustRequestSchema.parse(
      pointAdjustRequest({ points }),
    )

    expect(PointWriteMapper.fromAdjustRequest(request)).toStrictEqual({
      type: 'adjusted',
      request: {
        customerId: CUSTOMER_ID,
        points,
        description: '取り消した売上の付与を戻す',
        referenceType: null,
        referenceId: null,
      },
    })
  })

  it.each<[string, string | null, string | null]>([
    ['of one customer, before a day', CUSTOMER_ID, '2026-11-01'],
    ['of every customer, before the latest day there is', null, null],
  ])(
    'returns an expire request as the expiry %s',
    (_named, customer, processBefore) => {
      expect(
        PointWriteMapper.fromExpireRequest(
          pointExpireRequestSchema.parse({
            customerId: customer,
            processBefore,
          }),
        ),
      ).toStrictEqual({ customerId: customer, processBefore })
    },
  )

  it.each<[string, ApiPointExpiringSearchRequest, number]>([
    ['30 days when the request does not say', {}, 30],
    ['the days the request names', { days: 7 }, 7],
  ])('counts the points as expiring within %s', (_named, request, days) => {
    expect(PointWriteMapper.fromExpiringSearchRequest(request)).toStrictEqual({
      days,
    })
  })
})

describe('PointWriteMapper.fromTransactionSearchRequest', () => {
  it('lists the first 20 point transactions of the customer when the request names nothing', () => {
    expect(
      PointWriteMapper.fromTransactionSearchRequest(
        pointTransactionSearchRequestSchema.parse({}),
        customerId,
      ),
    ).toStrictEqual({
      customerId: CUSTOMER_ID,
      limit: 20,
      after: null,
      startDate: null,
      endDate: null,
    })
  })

  it('takes the place of the page and every filter the request names', () => {
    expect(
      PointWriteMapper.fromTransactionSearchRequest(
        pointTransactionSearchRequestSchema.parse({
          limit: 5,
          cursor: POINT_TRANSACTION_ID,
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-30T23:59:59.999Z',
        }),
        customerId,
      ),
    ).toStrictEqual({
      customerId: CUSTOMER_ID,
      limit: 5,
      after: POINT_TRANSACTION_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    })
  })

  it.each<[string, Record<string, string>]>([
    ['the earliest moment', { startDate: '2026-11-01T00:00:00.000Z' }],
    ['the latest moment', { endDate: '2026-11-30T23:59:59.999Z' }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      PointWriteMapper.fromTransactionSearchRequest(
        pointTransactionSearchRequestSchema.parse(filter),
        customerId,
      ),
    ).toStrictEqual({
      customerId: CUSTOMER_ID,
      limit: 20,
      after: null,
      startDate: null,
      endDate: null,
      ...filter,
    })
  })
})
