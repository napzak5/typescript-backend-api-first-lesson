import type { paymentTransactions } from '@beauty-salon-backend/database'
import { match } from 'ts-pattern'

/**
 * Rows of `payment_transactions` that tests write directly. The table
 * states what a payment of each status has (migration `202611160900`), so
 * a row is written with what its status asks for.
 */

export type NewPayment = typeof paymentTransactions.$inferInsert
export type PaymentStatus = NewPayment['status']

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partial_refund',
]

const RECEIVED_AT = '2026-11-20 12:42:10+09'
const FAILED_AT = '2026-11-20 12:42:11+09'
const REFUNDED_AT = '2026-11-22 09:00:00+09'

/**
 * What a payment of a status and an amount has besides them: a payment
 * that was received has the time it was received at, a refunded one the
 * refund (all of it, or one yen of it), a failed one the time it failed
 * at.
 */
const columnsOf = (
  status: PaymentStatus,
  amount: number,
): Partial<NewPayment> =>
  match(status)
    .returnType<Partial<NewPayment>>()
    .with('pending', 'processing', () => ({}))
    .with('completed', () => ({ processedAt: RECEIVED_AT }))
    .with('failed', () => ({ failedAt: FAILED_AT }))
    .with('refunded', () => ({
      processedAt: RECEIVED_AT,
      refundedAt: REFUNDED_AT,
      refundAmount: amount,
    }))
    .with('partial_refund', () => ({
      processedAt: RECEIVED_AT,
      refundedAt: REFUNDED_AT,
      refundAmount: 1,
    }))
    .exhaustive()

/**
 * The columns of a payment that keep the rules of the table: 6,600 yen
 * that were received, unless a test says otherwise. What a test states
 * itself is written as it states it.
 */
export const paymentColumns = (
  overrides: Partial<NewPayment> = {},
): Pick<NewPayment, 'amount' | 'status'> & Partial<NewPayment> => {
  const amount = overrides.amount ?? 6600
  const status = overrides.status ?? 'completed'

  return { amount, status, ...columnsOf(status, amount), ...overrides }
}
