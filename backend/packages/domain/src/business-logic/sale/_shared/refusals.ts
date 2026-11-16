import { match } from 'ts-pattern'
import type { SaleCreation } from '../../../repositories/sale.repository'
import { type DomainError, DomainErrors } from '../../../shared'

/** A refusal that says something about the request or about what it meets. */
type AnsweredRefusal = Exclude<
  SaleCreation,
  { type: 'created' | 'saleNumberTaken' }
>

/**
 * Why a sale was not entered, as the error a client gets. A sale number
 * that is taken is not among the reasons: the client did not choose it,
 * and the use case tries another.
 */
export const toRefusalError = (
  refusal: AnsweredRefusal,
  message: string,
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
