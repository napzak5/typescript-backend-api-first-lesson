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
import { Result } from '@beauty-salon-backend/utility'
import { and, eq } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import { CLOCK, CLOCK_ONCE, ONE_MOMENT } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { written } from '../database/written'
import { heldSaleOf, within } from './_shared/held-sale'

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

/**
 * The payment that is refunded and the sale it is of, held `FOR UPDATE` by
 * one statement until the refund is written. The sale is held as every
 * writer of a sale and of its payments holds it first, so a refund waits
 * for the payment, the void or the change of the sale that is under way.
 * The payment is held with it, and what it says of its money is what the
 * refund it waited for left. Only a refund holds a payment, and every
 * refund holds both rows in this statement. A payment stays with its sale,
 * so the sale is the one the payment names. Null when no payment with the
 * ID is of a sale within the reach.
 */
const heldPaymentOf = async (
  tx: DatabaseExecutor,
  id: PaymentId,
  reach: LedgerReach,
) => {
  const [held] = await tx
    .select({
      saleId: sales.id,
      totalAmount: sales.totalAmount,
      payment: {
        status: paymentTransactions.status,
        amount: paymentTransactions.amount,
        refundAmount: paymentTransactions.refundAmount,
      },
    })
    .from(sales)
    .innerJoin(paymentTransactions, eq(paymentTransactions.saleId, sales.id))
    .where(and(eq(paymentTransactions.id, id), within(reach)))
    .for('update', { of: [sales, paymentTransactions] })

  return held ?? null
}

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
    const refunding = await attempt('Failed to refund payment', () =>
      this.db.transaction(
        async (tx): Promise<PaymentRefunding | null> => {
          const held = await heldPaymentOf(tx, id, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          const others = (await moneyOfSale(tx, held.saleId)).filter(
            (one) => one.id !== id,
          )
          const plan = planRefund(held, held.payment, others, request)
          if (plan.type !== 'planned') {
            return plan
          }

          const [refunded] = await tx
            .update(paymentTransactions)
            .set({ ...plan.write.payment, refundedAt: CLOCK, updatedAt: CLOCK })
            .where(eq(paymentTransactions.id, id))
            .returning()
          if (refunded === undefined) {
            return null
          }
          await tx
            .update(sales)
            .set({ paymentStatus: plan.write.paymentStatus, updatedAt: CLOCK })
            .where(eq(sales.id, held.saleId))

          return { type: 'refunded', payment: refunded }
        },
        // Each statement sees what was committed before it: the payments of
        // the sale are those of the moment the sale was held.
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(refunding, written('Update of refunded payment'))
  }
}
