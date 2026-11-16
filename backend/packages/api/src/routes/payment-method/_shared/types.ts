import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/** The salon and the payment method of the request. */
export type PaymentMethodParams = SalonParams & { id: string }

export type ListPaymentMethodsResponse = JsonBody<
  operations['PaymentMethodCrud_list']['responses'][200]['content']
>
export type CreatePaymentMethodResponse = JsonBody<
  operations['PaymentMethodCrud_create']['responses'][201]['content']
>
export type GetPaymentMethodResponse = JsonBody<
  operations['PaymentMethodCrud_get']['responses'][200]['content']
>
export type UpdatePaymentMethodResponse = JsonBody<
  operations['PaymentMethodCrud_update']['responses'][200]['content']
>
