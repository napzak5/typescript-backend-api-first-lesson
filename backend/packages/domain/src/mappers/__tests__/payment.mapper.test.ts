import { describe, expect, it } from 'vitest'
import {
  apiRefundedPayment,
  paymentRefundRequest,
  refundedPayment,
  saleProcessRequest,
} from '../../__tests__/fixtures/payment-fixtures'
import { PAYMENT_METHOD_ID } from '../../__tests__/fixtures/payment-method-fixtures'
import {
  apiPayment,
  dbPayment,
  PAYMENT_ID,
} from '../../__tests__/fixtures/sale-fixtures'
import type { DbPaymentTransaction } from '../../models/sale'
import { saleProcessRequestSchema } from '../../schemas/payment.schema'
import { PaymentReadMapper } from '../read/payment.mapper'
import { PaymentWriteMapper } from '../write/payment.mapper'

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

const OTHER_PAYMENT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3c02'

const toApi = (overrides: Partial<DbPaymentTransaction> = {}) =>
  PaymentReadMapper.toApiPayment(dbPayment(overrides))

const storedRowIsCorrupt = (id: string = PAYMENT_ID) => ({
  type: 'error',
  error: {
    type: 'database',
    message: `Stored payment ${id} does not match the API model`,
    cause: expect.objectContaining({
      type: 'validation',
      message: 'Invalid stored payment',
    }),
  },
})

describe('PaymentReadMapper.toApiPayment', () => {
  it('returns every column under its own name, with the timestamps in ISO 8601 UTC', () => {
    expect(toApi()).toEqual({ type: 'success', data: apiPayment() })
  })

  it('has exactly the properties of PaymentResponse: what a processor answered stays in the ledger', () => {
    const result = toApi()

    expect(
      result.type === 'success' ? Object.keys(result.data).toSorted() : [],
    ).toEqual(PAYMENT_PROPERTIES)
  })

  it('returns a payment as the record of it is written: nothing of a processor, no card', () => {
    expect(
      toApi({
        processorTransactionId: null,
        processorResponse: null,
        metadata: null,
        cardLastFour: null,
        cardBrand: null,
      }),
    ).toEqual({
      type: 'success',
      data: apiPayment({
        processorTransactionId: null,
        cardLastFour: null,
        cardBrand: null,
      }),
    })
  })

  it('returns what a payment gets when it is refunded', () => {
    expect(PaymentReadMapper.toApiPayment(refundedPayment())).toEqual({
      type: 'success',
      data: apiRefundedPayment(),
    })
  })

  it('returns what a payment that failed has', () => {
    expect(
      toApi({
        status: 'failed',
        processedAt: null,
        failedAt: '2026-11-20 12:42:11+09',
        errorCode: 'card_declined',
        errorMessage: 'The card was declined',
      }),
    ).toEqual({
      type: 'success',
      data: apiPayment({
        status: 'failed',
        processedAt: null,
        failedAt: '2026-11-20T03:42:11.000Z',
        errorCode: 'card_declined',
        errorMessage: 'The card was declined',
      }),
    })
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
      expect(toApi(payment)).toEqual(storedRowIsCorrupt())
    },
  )

  it('names the payment whose row is at fault', () => {
    expect(toApi({ id: OTHER_PAYMENT_ID, createdAt: 'then' })).toEqual(
      storedRowIsCorrupt(OTHER_PAYMENT_ID),
    )
  })
})

describe('PaymentWriteMapper', () => {
  it('returns the request of a payment as the payment that is asked for', () => {
    const request = saleProcessRequestSchema.parse(saleProcessRequest())

    expect(PaymentWriteMapper.fromSaleProcessRequest(request)).toStrictEqual({
      paymentMethodId: PAYMENT_METHOD_ID,
      amount: 12650,
      cardLastFour: '4242',
      cardBrand: 'visa',
    })
  })

  it('keeps a payment without a card as it is', () => {
    const request = saleProcessRequestSchema.parse({
      ...saleProcessRequest(),
      cardLastFour: null,
      cardBrand: null,
    })

    expect(PaymentWriteMapper.fromSaleProcessRequest(request)).toMatchObject({
      cardLastFour: null,
      cardBrand: null,
    })
  })

  it.each<[string, string | null]>([
    ['the reason the request gives', '商品の返品'],
    ['no reason', null],
  ])(
    'returns a refund request as the refund that is asked for, with %s',
    (_named, refundReason) => {
      expect(
        PaymentWriteMapper.fromRefundRequest({
          ...paymentRefundRequest(),
          refundReason,
        }),
      ).toStrictEqual({ refundAmount: 5500, refundReason })
    },
  )
})
