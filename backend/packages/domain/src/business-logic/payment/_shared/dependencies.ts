import type { IPaymentRepository } from '../../../repositories/payment.repository'
import type { IPaymentNumberIssuer } from '../../../services/payment-number-issuer'

/** Everything the payment use cases need from the outside. */
export interface PaymentUseCaseDependencies {
  paymentRepository: IPaymentRepository
  paymentNumberIssuer: IPaymentNumberIssuer
}
