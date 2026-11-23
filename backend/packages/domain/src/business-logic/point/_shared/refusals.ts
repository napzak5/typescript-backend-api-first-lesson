import { pointMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { type DomainError, DomainErrors } from '../../../shared'
import type { PointRefusal } from './plan'

/** Why a movement of points is refused, as the error a client gets. */
export const toPointRefusalError = (refusal: PointRefusal): DomainError =>
  match(refusal)
    .with({ type: 'referenceClosed', reference: 'sale' }, () =>
      DomainErrors.conflict(pointMessages.saleIsVoid),
    )
    .with({ type: 'referenceClosed', reference: 'booking' }, () =>
      DomainErrors.conflict(pointMessages.bookingNotHeld),
    )
    .with({ type: 'referenceTaken' }, () =>
      DomainErrors.conflict(pointMessages.recordHasTransaction),
    )
    .with({ type: 'balanceShort' }, () =>
      DomainErrors.conflict(pointMessages.balanceBelowZero),
    )
    .with({ type: 'balanceOverLimit' }, () =>
      DomainErrors.conflict(pointMessages.balanceAboveLimit),
    )
    .exhaustive()
