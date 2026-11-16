import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { CustomerReach } from '../../../models/booking'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  profileAccessOf,
  profileNotFound,
} from '../../customer/_shared/profile'

/**
 * The bookings the signed-in customer reaches: their own, at whatever
 * salon and whoever entered them. Only a customer account has any, once it
 * has a profile; an account without one is answered as its profile is.
 * Administrators and the members of a salon keep the ledger instead.
 */
export const ownBookingsOf = (
  actor: Actor,
): Result<CustomerReach, DomainError> =>
  match(profileAccessOf(actor))
    .returnType<Result<CustomerReach, DomainError>>()
    .with({ type: 'notACustomer' }, () =>
      Result.error(DomainErrors.forbidden()),
    )
    .with({ type: 'withoutProfile' }, () =>
      Result.error(profileNotFound(actor)),
    )
    .with({ type: 'ownProfile' }, ({ customerId }) =>
      Result.success({ type: 'customer', customerId }),
    )
    .exhaustive()
