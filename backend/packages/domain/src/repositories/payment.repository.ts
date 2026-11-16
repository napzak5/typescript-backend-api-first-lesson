import type { Result } from '@beauty-salon-backend/utility'
import type {
  PaymentOrigin,
  PaymentPlan,
  PaymentRefusal,
  RefundPlan,
} from '../business-logic/payment/_shared/plan'
import type { LedgerReach } from '../models/booking'
import type { PaymentId } from '../models/payment'
import type { DbPaymentTransaction, SaleId } from '../models/sale'
import type {
  PaymentRefundRequest,
  SaleProcessRequest,
} from '../schemas/payment.schema'
import type { DomainError } from '../shared'

/**
 * What became of the payment a request asked to record:
 * - `recorded`: the payment as it is stored
 * - `notFound`: no sale with the ID is within the reach
 * - `transactionNumberTaken`: another payment has the number
 * - otherwise why the sale takes no payment (`refusalOfPayment`) or why
 *   the payment was not planned (`planPayment`)
 */
export type PaymentRecording =
  | { type: 'recorded'; payment: DbPaymentTransaction }
  | { type: 'notFound' }
  | { type: 'transactionNumberTaken' }
  | PaymentRefusal
  | Exclude<PaymentPlan, { type: 'planned' }>

/**
 * What became of the request to refund a payment:
 * - `refunded`: the payment as it is stored now
 * - `notFound`: no payment with the ID is of a sale within the reach
 * - otherwise why the refund was not planned (`planRefund`)
 */
export type PaymentRefunding =
  | { type: 'refunded'; payment: DbPaymentTransaction }
  | { type: 'notFound' }
  | Exclude<RefundPlan, { type: 'planned' }>

/**
 * Persistence of the payments of the sales. A payment is written and
 * refunded with its sale held, so the payments of one sale are written one
 * after the other, each with the payment status the sale has with it. A
 * writer names the sales it reaches, and a payment of a sale outside of
 * them is one that does not exist.
 */
export interface IPaymentRepository {
  /**
   * Holds the sale, plans the payment from the payments the sale has and
   * from the payment method the request names (`planPayment`), and writes
   * it. Of the payments that are recorded for one sale at the same moment,
   * each meets what the one before it left to pay.
   */
  record(
    saleId: SaleId,
    reach: LedgerReach,
    request: SaleProcessRequest,
    origin: PaymentOrigin,
  ): Promise<Result<PaymentRecording, DomainError>>

  /**
   * Holds the sale of the payment, plans the refund (`planRefund`) and
   * writes it. Of the refunds of one payment at the same moment, the
   * second meets the payment as refunded.
   */
  refund(
    id: PaymentId,
    reach: LedgerReach,
    request: PaymentRefundRequest,
  ): Promise<Result<PaymentRefunding, DomainError>>
}
