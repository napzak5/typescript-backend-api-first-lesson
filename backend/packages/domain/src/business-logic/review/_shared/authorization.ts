import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { CustomerId } from '../../../models/customer'
import { type DomainError, DomainErrors } from '../../../shared'
import { profileAccessOf } from '../../customer/_shared/profile'

/**
 * The customer a review is written as: the signed-in customer, once the
 * account has a profile. A review is the voice of a customer, so no one
 * writes one for them: administrators and the members of a salon are
 * refused, and so is an account without a profile, which has no bookings.
 */
export const reviewerOf = (actor: Actor): Result<CustomerId, DomainError> =>
  match(profileAccessOf(actor))
    .returnType<Result<CustomerId, DomainError>>()
    .with({ type: 'ownProfile' }, ({ customerId }) =>
      Result.success(customerId),
    )
    .with({ type: 'withoutProfile' }, { type: 'notACustomer' }, () =>
      Result.error(DomainErrors.forbidden()),
    )
    .exhaustive()
