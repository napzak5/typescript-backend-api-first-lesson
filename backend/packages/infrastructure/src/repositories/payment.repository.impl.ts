import {
  paymentMethods,
  paymentTransactions,
  sales,
} from '@beauty-salon-backend/database'
import {
  type DomainError,
  type IPaymentRepository,
  type LedgerReach,
  type PaymentId,
  type PaymentOrigin,
  type PaymentRecording,
  type PaymentRefunding,
  planPayment,
  planRefund,
  type RequestedPayment,
  type RequestedRefund,
  refusalOfPayment,
  type SaleId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, eq } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import { CLOCK, CLOCK_ONCE, ONE_MOMENT } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { heldSaleOf, within } from './held-sale'

/**
 * What the payments of a sale say of its money. Read in a statement of its
 * own after the sale is held: a payment or a refund that was being written
 * when the sale was asked for is among these.
 */
const moneyOfSale = (tx: DatabaseExecutor, saleId: string) =>
  tx
    .select({
      id: paymentTransactions.id,
      status: paymentTransactions.status,
      amount: paymentTransactions.amount,
      refundAmount: paymentTransactions.refundAmount,
    })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.saleId, saleId))

export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly db: Database) {}

  async record(
    saleId: SaleId,
    reach: LedgerReach,
    request: RequestedPayment,
    origin: PaymentOrigin,
  ): Promise<Result<PaymentRecording, DomainError>> {
    return attempt('Failed to record payment', () =>
      this.db.transaction(
        async (tx): Promise<PaymentRecording> => {
          const held = await heldSaleOf(tx, saleId, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          const payments = await moneyOfSale(tx, saleId)
          const refusal = refusalOfPayment(held.sale, payments)
          if (refusal !== null) {
            return refusal
          }

          // Shared with other payments, and not with a change or the
          // removal of the payment method: one that was under way has been
          // made when this statement returns the row, and the next one
          // waits until the payment is written. The payment method is the
          // last row a payment holds; whoever holds a payment method holds
          // nothing else.
          const [paymentMethod] = await tx
            .select({
              method: paymentMethods.method,
              isActive: paymentMethods.isActive,
              minimumAmount: paymentMethods.minimumAmount,
              maximumAmount: paymentMethods.maximumAmount,
            })
            .from(paymentMethods)
            .where(
              and(
                eq(paymentMethods.id, request.paymentMethodId),
                eq(paymentMethods.salonId, held.sale.salonId),
              ),
            )
            .for('share')
          const plan = planPayment(
            held.sale,
            payments,
            paymentMethod ?? null,
            request,
            origin,
          )
          if (plan.type !== 'planned') {
            return plan
          }

          // The times are read when the row is written, not when the
          // transaction began: a payment that waited for the sale is later
          // than the one it waited for.
          const [payment] = await tx
            .with(CLOCK_ONCE)
            .insert(paymentTransactions)
            .values({
              ...plan.write.payment,
              processedAt: ONE_MOMENT,
              createdAt: ONE_MOMENT,
              updatedAt: ONE_MOMENT,
            })
            .onConflictDoNothing({
              target: paymentTransactions.transactionNumber,
            })
            .returning()
          if (payment === undefined) {
            return { type: 'transactionNumberTaken' }
          }
          await tx
            .update(sales)
            .set({ paymentStatus: plan.write.paymentStatus, updatedAt: CLOCK })
            .where(eq(sales.id, saleId))

          return { type: 'recorded', payment }
        },
        // Each statement sees what was committed before it: a payment that
        // waited for the sale sees the payment it waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async refund(
    id: PaymentId,
    reach: LedgerReach,
    request: RequestedRefund,
  ): Promise<Result<PaymentRefunding, DomainError>> {
    return attempt('Failed to refund payment', () =>
      this.db.transaction(
        async (tx): Promise<PaymentRefunding> => {
          // A payment stays with its sale, so the sale is learnt without a
          // lock and held before anything of the payment is decided: the
          // sale is the first row a refund holds, as it is for a payment
          // and for a void.
          const [found] = await tx
            .select({ saleId: paymentTransactions.saleId })
            .from(paymentTransactions)
            .innerJoin(sales, eq(sales.id, paymentTransactions.saleId))
            .where(and(eq(paymentTransactions.id, id), within(reach)))
          if (found === undefined) {
            return { type: 'notFound' }
          }
          const held = await heldSaleOf(tx, found.saleId, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          const payments = await moneyOfSale(tx, found.saleId)
          const payment = payments.find((one) => one.id === id)
          if (payment === undefined) {
            return { type: 'notFound' }
          }
          const plan = planRefund(
            held.sale,
            payment,
            payments.filter((one) => one.id !== id),
            request,
          )
          if (plan.type !== 'planned') {
            return plan
          }

          const [refunded] = await tx
            .update(paymentTransactions)
            .set({ ...plan.write.payment, refundedAt: CLOCK, updatedAt: CLOCK })
            .where(eq(paymentTransactions.id, id))
            .returning()
          if (refunded === undefined) {
            return { type: 'notFound' }
          }
          await tx
            .update(sales)
            .set({ paymentStatus: plan.write.paymentStatus, updatedAt: CLOCK })
            .where(eq(sales.id, found.saleId))

          return { type: 'refunded', payment: refunded }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }
}
