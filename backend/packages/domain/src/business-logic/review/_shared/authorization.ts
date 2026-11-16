import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { CustomerId } from '../../../models/customer'
import { type DomainError, DomainErrors } from '../../../shared'
import { profileAccessOf } from '../../customer/_shared/profile'
import type { ReviewRemover } from './change'

/**
 * The customer a review is written as: the signed-in customer, once the
 * account has a profile. A review is the voice of a customer, so no one
 * writes one for them: administrators and the members of a salon are
 * refused, and so is an account without a profile, which has no bookings.
 * The same customer is the one who changes the reviews they wrote, and
 * who marks the reviews of others as helpful: the helpful order is the
 * customers' word on the reviews, which a salon does not raise.
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

/**
 * Who removes a review: an administrator, who takes down what breaks the
 * rules of the platform or what its author asks to have removed, or the
 * customer who wrote it. The members of a salon are refused, so a salon
 * does not remove what it does not like to read.
 */
export const reviewRemoverOf = (
  actor: Actor,
): Result<ReviewRemover, DomainError> =>
  match(actor.scope)
    .returnType<Result<ReviewRemover, DomainError>>()
    .with({ type: 'platform' }, () => Result.success({ type: 'administrator' }))
    .with({ type: 'salon' }, { type: 'customer' }, { type: 'none' }, () =>
      Result.map(
        reviewerOf(actor),
        (customerId): ReviewRemover => ({ type: 'author', customerId }),
      ),
    )
    .exhaustive()
