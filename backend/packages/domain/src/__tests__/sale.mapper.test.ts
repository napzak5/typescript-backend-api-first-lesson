import { describe, expect, it } from 'vitest'
import { SaleReadMapper } from '../mappers/read/sale.mapper'
import type {
  DbPaymentTransaction,
  DbSale,
  DbSalesDetail,
} from '../models/sale'
import {
  apiPayment,
  apiSale,
  apiSalesDetails,
  dbPayment,
  dbSalesDetails,
  OTHER_SALE_ID,
  SALE_ID,
  saleWithDetails,
} from './sale-fixtures'

/** The properties of a SaleResponse. */
const RESPONSE_PROPERTIES = [
  'bookingId',
  'createdAt',
  'customerId',
  'details',
  'discountAmount',
  'id',
  'isVoid',
  'notes',
  'paymentStatus',
  'payments',
  'pointsEarned',
  'pointsUsed',
  'saleDate',
  'saleNumber',
  'saleTime',
  'salonId',
  'staffId',
  'subtotal',
  'taxAmount',
  'totalAmount',
  'updatedAt',
  'voidReason',
  'voidedAt',
]

/** The properties of a SalesDetail. */
const DETAIL_PROPERTIES = [
  'commissionAmount',
  'commissionRate',
  'discountAmount',
  'itemId',
  'itemName',
  'itemType',
  'notes',
  'quantity',
  'sortOrder',
  'staffId',
  'taxAmount',
  'totalAmount',
  'unitPrice',
]

/** The properties of a PaymentResponse. */
const PAYMENT_PROPERTIES = [
  'amount',
  'cardBrand',
  'cardLastFour',
  'createdAt',
  'errorCode',
  'errorMessage',
  'failedAt',
  'id',
  'paymentMethodId',
  'processedAt',
  'processorTransactionId',
  'refundAmount',
  'refundReason',
  'refundedAt',
  'saleId',
  'status',
  'transactionNumber',
  'updatedAt',
]

/** The first line of the fixtures with these columns changed. */
const detailWith = (overrides: Partial<DbSalesDetail>): DbSalesDetail[] =>
  dbSalesDetails().map((detail, index) =>
    index === 0 ? { ...detail, ...overrides } : detail,
  )

const toApi = (
  sale: Partial<DbSale> = {},
  details: DbSalesDetail[] = dbSalesDetails(),
  payments: DbPaymentTransaction[] = [],
) => SaleReadMapper.toApiSale(saleWithDetails(sale, details, payments))

/** The response of a sale that is mapped; anything else fails the test. */
const mapped = (
  sale: Partial<DbSale> = {},
  details: DbSalesDetail[] = dbSalesDetails(),
  payments: DbPaymentTransaction[] = [],
) => {
  const result = toApi(sale, details, payments)
  if (result.type === 'error') {
    throw new Error(`The sale was not mapped: ${result.error.type}`)
  }
  return result.data
}

const storedRowIsCorrupt = (id: string = SALE_ID) => ({
  type: 'error',
  error: {
    type: 'database',
    message: `Stored sale ${id} does not match the API model`,
    cause: expect.objectContaining({ type: 'validation' }),
  },
})

describe('SaleReadMapper.toApiSale', () => {
  it('returns every column under its own name, with the timestamps in ISO 8601 UTC', () => {
    expect(toApi()).toEqual({ type: 'success', data: apiSale() })
  })

  it('has exactly the properties of SaleResponse', () => {
    expect(Object.keys(mapped()).toSorted()).toEqual(RESPONSE_PROPERTIES)
  })

  it('has exactly the properties of SalesDetail for every line: a line is told by its place', () => {
    const { details } = mapped()

    expect(details).toHaveLength(3)
    expect(details.map((detail) => Object.keys(detail).toSorted())).toEqual([
      DETAIL_PROPERTIES,
      DETAIL_PROPERTIES,
      DETAIL_PROPERTIES,
    ])
  })

  it('has exactly the properties of PaymentResponse for every payment: what the processor answered stays in the ledger', () => {
    const { payments } = mapped({}, dbSalesDetails(), [dbPayment()])

    expect(payments.map((payment) => Object.keys(payment).toSorted())).toEqual([
      PAYMENT_PROPERTIES,
    ])
  })

  it('returns the commission rate as a number and the day as it is stored', () => {
    const { saleDate, details } = mapped(
      { saleDate: '2026-11-19' },
      detailWith({ commissionRate: '7.25' }),
    )

    expect(saleDate).toBe('2026-11-19')
    expect(details.map(({ commissionRate }) => commissionRate)).toEqual([
      7.25,
      12.5,
      null,
    ])
  })

  it('keeps null as null', () => {
    const withoutOptionalValues = {
      customerId: null,
      staffId: null,
      bookingId: null,
      pointsUsed: null,
      pointsEarned: null,
      notes: null,
    }

    expect(
      toApi(
        withoutOptionalValues,
        detailWith({
          itemId: null,
          staffId: null,
          commissionRate: null,
          commissionAmount: null,
        }),
      ),
    ).toEqual({
      type: 'success',
      data: apiSale({
        ...withoutOptionalValues,
        details: apiSalesDetails().map((detail, index) =>
          index === 0
            ? {
                ...detail,
                itemId: null,
                staffId: null,
                commissionRate: null,
                commissionAmount: null,
              }
            : detail,
        ),
      }),
    })
  })

  it('returns what a sale gets later in its life', () => {
    expect(
      mapped({
        paymentStatus: 'refunded',
        isVoid: true,
        voidedAt: '2026-11-21 10:15:00.5+09',
        voidReason: '二重登録',
      }),
    ).toMatchObject({
      paymentStatus: 'refunded',
      isVoid: true,
      voidedAt: '2026-11-21T01:15:00.500Z',
      voidReason: '二重登録',
    })
  })

  it('returns the payments of a sale with their timestamps in ISO 8601 UTC', () => {
    expect(mapped({}, dbSalesDetails(), [dbPayment()]).payments).toEqual([
      apiPayment(),
    ])
  })

  it('returns what a payment gets when it fails or is refunded', () => {
    const { payments } = mapped({}, dbSalesDetails(), [
      dbPayment({
        status: 'failed',
        processedAt: null,
        failedAt: '2026-11-20 12:42:11+09',
        errorCode: 'card_declined',
        errorMessage: 'The card was declined',
        cardLastFour: null,
        cardBrand: null,
        processorTransactionId: null,
      }),
      dbPayment({
        id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3c02',
        status: 'partial_refund',
        refundedAt: '2026-11-22 09:00:00+09',
        refundAmount: 5500,
        refundReason: '商品の返品',
      }),
    ])

    expect(payments).toEqual([
      apiPayment({
        status: 'failed',
        processedAt: null,
        failedAt: '2026-11-20T03:42:11.000Z',
        errorCode: 'card_declined',
        errorMessage: 'The card was declined',
        cardLastFour: null,
        cardBrand: null,
        processorTransactionId: null,
      }),
      apiPayment({
        id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3c02',
        status: 'partial_refund',
        refundedAt: '2026-11-22T00:00:00.000Z',
        refundAmount: 5500,
        refundReason: '商品の返品',
      }),
    ])
  })

  it('keeps the lines and the payments in the order they are given', () => {
    const [cut, shampoo, fee] = dbSalesDetails()
    const later = dbPayment({ id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3c02' })
    const { details, payments } = mapped(
      {},
      [fee, cut, shampoo].flatMap((detail) => detail ?? []),
      [later, dbPayment()],
    )

    expect(details.map(({ itemName }) => itemName)).toEqual([
      '指名料',
      'カット',
      'シャンプー',
    ])
    expect(payments.map(({ id }) => id)).toEqual([later.id, dbPayment().id])
  })

  it('returns a sale without lines or payments with empty lists', () => {
    expect(mapped({}, [], [])).toMatchObject({ details: [], payments: [] })
  })

  it.each<[string, Partial<DbSale>]>([
    ['a time of the sale that is none', { saleTime: 'noon' }],
    ['a time it was voided at that is none', { voidedAt: 'yesterday' }],
    ['a time it was created at that is none', { createdAt: '' }],
    ['a time it was updated at that is none', { updatedAt: 'now' }],
  ])(
    'reports a stored sale with %s as a fault of the database',
    (_case, sale) => {
      expect(toApi(sale)).toEqual(storedRowIsCorrupt())
    },
  )

  it('reports a stored line whose commission rate is no number as a fault of the database', () => {
    expect(toApi({}, detailWith({ commissionRate: 'forty' }))).toEqual(
      storedRowIsCorrupt(),
    )
  })

  it.each<[string, Partial<DbPaymentTransaction>]>([
    ['a time it was processed at that is none', { processedAt: 'soon' }],
    ['a time it failed at that is none', { failedAt: 'never' }],
    ['a time it was refunded at that is none', { refundedAt: 'later' }],
    ['a time it was created at that is none', { createdAt: '' }],
    ['a time it was updated at that is none', { updatedAt: 'now' }],
  ])(
    'reports a stored payment with %s as a fault of the database',
    (_case, payment) => {
      expect(toApi({}, dbSalesDetails(), [dbPayment(payment)])).toEqual(
        storedRowIsCorrupt(),
      )
    },
  )

  it('names the sale whose rows are at fault', () => {
    expect(toApi({ id: OTHER_SALE_ID, saleTime: 'noon' })).toEqual(
      storedRowIsCorrupt(OTHER_SALE_ID),
    )
  })
})

describe('SaleReadMapper.toApiSales', () => {
  it('returns the sales in the order they are given', () => {
    const result = SaleReadMapper.toApiSales([
      saleWithDetails({ id: OTHER_SALE_ID }),
      saleWithDetails(),
    ])

    expect(result).toEqual({
      type: 'success',
      data: [apiSale({ id: OTHER_SALE_ID }), apiSale()],
    })
  })

  it('returns no sales for none', () => {
    expect(SaleReadMapper.toApiSales([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('reports the first sale whose stored row is at fault', () => {
    const result = SaleReadMapper.toApiSales([
      saleWithDetails(),
      saleWithDetails({ id: OTHER_SALE_ID, saleTime: 'noon' }),
      saleWithDetails({ saleTime: 'midnight' }),
    ])

    expect(result).toEqual(storedRowIsCorrupt(OTHER_SALE_ID))
  })
})
