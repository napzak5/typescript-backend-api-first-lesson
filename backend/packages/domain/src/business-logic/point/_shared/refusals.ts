import { match } from 'ts-pattern'
import { type DomainError, DomainErrors } from '../../../shared'
import type { PointRefusal } from './plan'

/** Why a movement of points is refused, as the error a client gets. */
export const toPointRefusalError = (refusal: PointRefusal): DomainError =>
  match(refusal)
    .with({ type: 'referenceClosed', reference: 'sale' }, () =>
      DomainErrors.conflict(
        'The sale is void; points are not earned on or used for a void sale',
      ),
    )
    .with({ type: 'referenceClosed', reference: 'booking' }, () =>
      DomainErrors.conflict(
        'The booking is a draft, cancelled or a no-show; points are not earned on or used for it',
      ),
    )
    .with({ type: 'referenceTaken' }, () =>
      DomainErrors.conflict(
        'The record has a point transaction of this kind already; a record is earned on once and used for once',
      ),
    )
    .with({ type: 'balanceShort' }, () =>
      DomainErrors.conflict('The balance of the customer would fall below 0'),
    )
    .with({ type: 'balanceOverLimit' }, () =>
      DomainErrors.conflict(
        'The balance of the customer would go above 2147483647',
      ),
    )
    .exhaustive()
