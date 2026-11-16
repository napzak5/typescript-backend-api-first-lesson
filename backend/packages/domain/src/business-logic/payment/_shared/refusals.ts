import { match } from 'ts-pattern'
import { type DomainError, DomainErrors } from '../../../shared'
import type { PaymentRefusal } from './plan'

/** Why a sale takes no payment, as the error a client gets. */
export const toPaymentRefusalError = (refusal: PaymentRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict('The sale is void; a void sale takes no payment'),
    )
    .with({ type: 'refundMade' }, () =>
      DomainErrors.conflict(
        'A payment of the sale was refunded; a sale with a refund takes no further payment',
      ),
    )
    .with({ type: 'nothingLeft' }, () =>
      DomainErrors.conflict('Nothing is left to pay of the sale'),
    )
    .exhaustive()

/** What a payment that cannot be refunded is told. */
export const NOT_COMPLETED = DomainErrors.conflict(
  'Only a payment that is completed is refunded; a payment is refunded once',
)
