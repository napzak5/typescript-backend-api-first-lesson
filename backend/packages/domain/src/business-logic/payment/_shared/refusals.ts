import { paymentMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { type DomainError, DomainErrors } from '../../../shared'
import type { PaymentRefusal } from './plan'

/** Why a sale takes no payment, as the error a client gets. */
export const toPaymentRefusalError = (refusal: PaymentRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict(paymentMessages.saleIsVoid),
    )
    .with({ type: 'refundMade' }, () =>
      DomainErrors.conflict(paymentMessages.saleHasRefund),
    )
    .with({ type: 'nothingLeft' }, () =>
      DomainErrors.conflict(paymentMessages.nothingLeftToPay),
    )
    .exhaustive()

/** What a payment that cannot be refunded is told. */
export const NOT_COMPLETED = DomainErrors.conflict(
  paymentMessages.onlyCompletedIsRefunded,
)
