import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The payment of a request to `/payments/:id`. */
export type PaymentParams = { id: string }

export type RefundPaymentResponse = JsonBody<
  operations['PaymentCrud_refund']['responses'][200]['content']
>
