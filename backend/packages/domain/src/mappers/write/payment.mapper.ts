import type {
  ApiPaymentRefundRequest,
  RequestedPayment,
  RequestedRefund,
} from '../../models/payment'
import type { SaleProcessRequest } from '../../schemas/payment.schema'

/**
 * API request → what the payments of a sale are asked with. Nothing is
 * converted and no row is made: what a payment and a refund write follows
 * from the sale, from its payments and from the payment method, so a pure
 * function plans it (`planPayment`, `planRefund`), and this mapper returns
 * what such a plan is made from. It is where the compiler checks that a
 * request holds what the plan reads.
 */
export const PaymentWriteMapper = {
  /** The payment a till asks to record for a sale. */
  fromSaleProcessRequest(request: SaleProcessRequest): RequestedPayment {
    return request
  },

  /** The refund of a payment, with the reason the request gives. */
  fromRefundRequest(request: ApiPaymentRefundRequest): RequestedRefund {
    return request
  },
}
