import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { BOOKING_ID } from '../../__tests__/fixtures/booking-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  apiPayment,
  apiSale,
  apiSalesDetails,
  dbPayment,
  dbSalesDetails,
  OTHER_SALE_ID,
  RECEIPT_TIME,
  SALE_ID,
  SALE_NUMBER,
  saleCalculateRequest,
  saleCreateRequest,
  saleWithDetails,
  TREATMENT_ID,
} from '../../__tests__/fixtures/sale-fixtures'
import type { CalculatedSale } from '../../business-logic/sale/_shared/calculation'
import { bookingIdSchema, type LedgerReach } from '../../models/booking'
import {
  type DbPaymentTransaction,
  type DbSale,
  type DbSalesDetail,
  saleIdSchema,
} from '../../models/sale'
import { salonIdSchema } from '../../models/salon'
import {
  saleCalculateRequestSchema,
  saleCreateRequestSchema,
  saleSearchRequestSchema,
  saleUpdateRequestSchema,
} from '../../schemas/sale.schema'
import { SaleReadMapper } from '../read/sale.mapper'
import { SaleWriteMapper } from '../write/sale.mapper'

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

describe('SaleReadMapper.toApiSalePage', () => {
  const paging = { limit: 2, after: saleIdSchema.parse(SALE_ID) }

  it('answers with the sales, the counts of the list and the place of the page', () => {
    expect(
      SaleReadMapper.toApiSalePage(
        {
          sales: [saleWithDetails({ id: OTHER_SALE_ID }), saleWithDetails()],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toEqual({
      type: 'success',
      data: {
        data: [apiSale({ id: OTHER_SALE_ID }), apiSale()],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: SALE_ID,
          nextCursor: SALE_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      SaleReadMapper.toApiSalePage(
        { sales: [saleWithDetails()], total: 1, hasMore: false },
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

  it('reports the first sale whose stored row is at fault', () => {
    expect(
      SaleReadMapper.toApiSalePage(
        {
          sales: [
            saleWithDetails(),
            saleWithDetails({ id: OTHER_SALE_ID, saleTime: 'noon' }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toEqual(storedRowIsCorrupt(OTHER_SALE_ID))
  })
})

describe('SaleReadMapper.toApiSaleReceipt', () => {
  it('answers with the sale under its own number and the moment the receipt was made', () => {
    expect(
      SaleReadMapper.toApiSaleReceipt(
        saleWithDetails({}, dbSalesDetails(), [dbPayment()]),
        RECEIPT_TIME,
      ),
    ).toEqual({
      type: 'success',
      data: {
        receiptNumber: SALE_NUMBER,
        sale: apiSale({ payments: [apiPayment()] }),
        issuedAt: '2026-11-20T04:00:00.000Z',
      },
    })
  })

  it('takes the number of the receipt from the sale, whatever it is', () => {
    expect(
      SaleReadMapper.toApiSaleReceipt(
        saleWithDetails({ saleNumber: 'SL-0000-0001' }),
        new Date('2027-01-01T00:00:00.000Z'),
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        receiptNumber: 'SL-0000-0001',
        sale: { saleNumber: 'SL-0000-0001' },
        issuedAt: '2027-01-01T00:00:00.000Z',
      },
    })
  })

  it('reports a sale whose stored row is at fault', () => {
    expect(
      SaleReadMapper.toApiSaleReceipt(
        saleWithDetails({ saleTime: 'noon' }),
        RECEIPT_TIME,
      ),
    ).toEqual(storedRowIsCorrupt())
  })
})

describe('SaleReadMapper.toApiSaleCalculation', () => {
  const calculated = (
    overrides: Partial<CalculatedSale> = {},
  ): CalculatedSale => ({
    salonId: salonIdSchema.parse(SALON_ID),
    bookingId: bookingIdSchema.parse(BOOKING_ID),
    breakdown: {
      subtotal: 12310,
      discountAmount: 300,
      taxAmount: 1201,
      totalAmount: 13211,
    },
    recommendedMethods: ['cash', 'credit_card'],
    ...overrides,
  })

  it('answers with what the sale was calculated for, its amounts and the kinds of payment method that take them', () => {
    expect(SaleReadMapper.toApiSaleCalculation(calculated())).toStrictEqual({
      salonId: SALON_ID,
      bookingId: BOOKING_ID,
      breakdown: {
        subtotal: 12310,
        discountAmount: 300,
        taxAmount: 1201,
        totalAmount: 13211,
      },
      recommendedMethods: ['cash', 'credit_card'],
    })
  })

  it('keeps a calculation without a booking and without a payment method as it is', () => {
    expect(
      SaleReadMapper.toApiSaleCalculation(
        calculated({ bookingId: null, recommendedMethods: [] }),
      ),
    ).toMatchObject({ bookingId: null, recommendedMethods: [] })
  })

  it('names every amount of the breakdown: what else the sums carry is not shown', () => {
    const sums = {
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 100,
      totalAmount: 1100,
      roundedPerLine: 99,
    }

    expect(
      SaleReadMapper.toApiSaleCalculation(calculated({ breakdown: sums }))
        .breakdown,
    ).toStrictEqual({
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 100,
      totalAmount: 1100,
    })
  })
})

describe('SaleWriteMapper', () => {
  it('returns a create request as the sale that is asked for, its lines among it', () => {
    const request = saleCreateRequestSchema.parse(saleCreateRequest())

    expect(SaleWriteMapper.fromCreateRequest(request)).toStrictEqual(request)
  })

  it('returns an update request as the correction it names, and nothing else', () => {
    const request = saleUpdateRequestSchema.parse({
      notes: null,
      pointsEarned: 0,
    })

    expect(SaleWriteMapper.fromUpdateRequest(request)).toStrictEqual({
      notes: null,
      pointsEarned: 0,
    })
  })

  it.each<[string, string | null]>([
    ['the reason the request gives', 'Entered twice'],
    ['no reason', null],
  ])(
    'returns a void request as the void of the sale, with %s',
    (_named, voidReason) => {
      expect(SaleWriteMapper.fromVoidRequest({ voidReason })).toStrictEqual({
        voidReason,
      })
    },
  )

  it('returns a calculate request as what the sale is calculated from, a service as often as it is named', () => {
    const request = saleCalculateRequestSchema.parse(saleCalculateRequest())

    expect(SaleWriteMapper.fromCalculateRequest(request)).toStrictEqual({
      salonId: SALON_ID,
      bookingId: BOOKING_ID,
      services: [TREATMENT_ID, TREATMENT_ID],
    })
  })
})

describe('SaleWriteMapper.fromSearchRequest', () => {
  const ofTheSalon: LedgerReach = {
    type: 'salon',
    salonId: salonIdSchema.parse(SALON_ID),
  }
  const unfiltered = {
    salonId: null,
    customerId: null,
    bookingId: null,
    paymentStatus: null,
    startDate: null,
    endDate: null,
  }

  it('lists the first 20 sales within the reach when the request names nothing', () => {
    expect(
      SaleWriteMapper.fromSearchRequest(
        saleSearchRequestSchema.parse({}),
        ofTheSalon,
      ),
    ).toStrictEqual({
      reach: ofTheSalon,
      limit: 20,
      after: null,
      ...unfiltered,
    })
  })

  it('takes the place of the page and every filter the request names', () => {
    expect(
      SaleWriteMapper.fromSearchRequest(
        saleSearchRequestSchema.parse({
          limit: 5,
          cursor: SALE_ID,
          salonId: SALON_ID,
          customerId: CUSTOMER_ID,
          bookingId: BOOKING_ID,
          paymentStatus: 'completed',
          startDate: '2026-11-01',
          endDate: '2026-11-30',
        }),
        { type: 'everySalon' },
      ),
    ).toStrictEqual({
      reach: { type: 'everySalon' },
      limit: 5,
      after: SALE_ID,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      paymentStatus: 'completed',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    })
  })

  it.each<[string, Record<string, string>]>([
    ['the salon', { salonId: SALON_ID }],
    ['the customer', { customerId: CUSTOMER_ID }],
    ['the booking', { bookingId: BOOKING_ID }],
    ['the payment status', { paymentStatus: 'pending' }],
    ['the first day', { startDate: '2026-11-01' }],
    ['the last day', { endDate: '2026-11-30' }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      SaleWriteMapper.fromSearchRequest(
        saleSearchRequestSchema.parse(filter),
        ofTheSalon,
      ),
    ).toStrictEqual({
      reach: ofTheSalon,
      limit: 20,
      after: null,
      ...unfiltered,
      ...filter,
    })
  })
})
