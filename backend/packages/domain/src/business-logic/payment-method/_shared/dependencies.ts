import type { IPaymentMethodRepository } from '../../../repositories/payment-method.repository'
import type { ISalonRepository } from '../../../repositories/salon.repository'

/** Everything the payment method use cases need from the outside. */
export interface PaymentMethodUseCaseDependencies {
  paymentMethodRepository: IPaymentMethodRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
}
