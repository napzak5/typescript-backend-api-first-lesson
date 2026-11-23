import { match } from 'ts-pattern'
import { type DomainError, DomainErrors, type Told } from '../../../shared'
import type { SaleChangeRefusal, SaleVoidRefusal } from './change'
import type { SalePlan } from './plan'
import type { ReceiptRefusal } from './receipt'

/** A refusal that says something about the request or about what it meets. */
type AnsweredRefusal = Exclude<SalePlan, { type: 'planned' }>

/**
 * Why a sale was not entered or not corrected, as the error a client gets.
 * A sale number that is taken is not among the reasons: the client did
 * not choose it, and the use case tries another.
 */
export const toRefusalError = (
  refusal: AnsweredRefusal,
  message: Told,
): DomainError =>
  match(refusal)
    .with({ type: 'invalid' }, ({ issues }) =>
      DomainErrors.validation(message, issues),
    )
    .with({ type: 'timeZoneUnknown' }, () =>
      DomainErrors.conflict(
        'The time zone of the salon is not one that is known, so the day of the sale cannot be told; correct the time zone of the salon first',
      ),
    )
    .with({ type: 'bookingBilled' }, () =>
      DomainErrors.conflict(
        'The booking has a sale that is not void; a booking is billed once',
      ),
    )
    .exhaustive()

/** Why a sale is not corrected whatever the request names, as the error a client gets. */
export const toChangeRefusalError = (refusal: SaleChangeRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict('The sale is void; a void sale is not changed'),
    )
    .with({ type: 'paymentBegun' }, () =>
      DomainErrors.conflict(
        'The lines of a sale are replaced only while its payment status is pending',
      ),
    )
    .exhaustive()

/** Why a sale has no receipt, as the error a client gets. */
export const toReceiptRefusalError = (refusal: ReceiptRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict('The sale is void; a void sale has no receipt'),
    )
    .with({ type: 'notPaidInFull' }, () =>
      DomainErrors.conflict(
        'The sale is not paid in full; a receipt is made once what was received comes to its total',
      ),
    )
    .exhaustive()

/** Why a sale is not voided, as the error a client gets. */
export const toVoidRefusalError = (refusal: SaleVoidRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict('The sale is void already'),
    )
    .with({ type: 'paid' }, () =>
      DomainErrors.conflict(
        'The sale has a payment that was not refunded; refund it before the sale is voided',
      ),
    )
    .exhaustive()
