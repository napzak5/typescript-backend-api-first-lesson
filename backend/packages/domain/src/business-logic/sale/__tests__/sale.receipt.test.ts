import { describe, expect, it } from 'vitest'
import {
  dbPayment,
  saleWithDetails,
} from '../../../__tests__/fixtures/sale-fixtures'
import type { DbPaymentTransaction, DbSale } from '../../../models/sale'
import { refusalOfReceipt } from '..'

/** The sale of the fixtures, which charges 12,650 yen, with these payments. */
const receiptOf = (
  payments: DbPaymentTransaction[],
  sale: Partial<DbSale> = {},
) => refusalOfReceipt(saleWithDetails(sale, undefined, payments))

const paid = (
  amount: number,
  overrides: Partial<DbPaymentTransaction> = {},
): DbPaymentTransaction => dbPayment({ amount, ...overrides })

describe('refusalOfReceipt', () => {
  it('makes the receipt of a sale that received its total', () => {
    expect(receiptOf([paid(12650)])).toBeNull()
  })

  it('makes the receipt of a sale that received its total in parts', () => {
    expect(receiptOf([paid(10000), paid(2000), paid(650)])).toBeNull()
  })

  it('refuses a sale that received a yen less than its total', () => {
    expect(receiptOf([paid(10000), paid(2649)])).toEqual({
      type: 'notPaidInFull',
    })
  })

  it('refuses a sale that received nothing', () => {
    expect(receiptOf([])).toEqual({ type: 'notPaidInFull' })
  })

  it.each<[DbPaymentTransaction['status']]>([
    ['pending'],
    ['processing'],
    ['failed'],
  ])(
    'counts nothing of a payment that is %s: the salon did not receive it',
    (status) => {
      expect(receiptOf([paid(12650, { status })])).toEqual({
        type: 'notPaidInFull',
      })
    },
  )

  it.each<[DbPaymentTransaction['status'], number]>([
    ['refunded', 12650],
    ['partial_refund', 2000],
  ])(
    'counts a payment that was %s as received: a receipt shows the refunds of a sale that was paid',
    (status, refundAmount) => {
      expect(receiptOf([paid(12650, { status, refundAmount })])).toBeNull()
    },
  )

  it('makes the receipt of a sale of nothing without a payment', () => {
    expect(
      receiptOf([], {
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
      }),
    ).toBeNull()
  })

  it('goes by the payments of the sale and not by its payment status', () => {
    expect(receiptOf([], { paymentStatus: 'completed' })).toEqual({
      type: 'notPaidInFull',
    })
    expect(receiptOf([paid(12650)], { paymentStatus: 'pending' })).toBeNull()
  })

  it('refuses a void sale, however it was paid', () => {
    expect(receiptOf([paid(12650)], { isVoid: true })).toEqual({ type: 'void' })
  })

  it('tells of the void before the payments', () => {
    expect(receiptOf([], { isVoid: true })).toEqual({ type: 'void' })
  })
})
