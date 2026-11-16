import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { parseReviewId, type ReviewId } from '../../models/review'
import type { DomainError } from '../../shared'
import { reviewRemoverOf } from './_shared/authorization'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'
import { toUnreachedReviewError } from './_shared/refusals'

export class DeleteReviewUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Removes a review, and counts the rating and the review count of the
   * salon again: an administrator removes any review, a customer the
   * reviews they wrote. The booking of the review may then be deleted, or
   * reviewed again. Resolves to the ID of the removed review.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ReviewId, DomainError>> {
    const remover = reviewRemoverOf(actor)
    if (remover.type === 'error') {
      return remover
    }
    const reviewId = parseReviewId(id)
    if (reviewId.type === 'error') {
      return reviewId
    }

    const removed = await this.dependencies.reviewRepository.delete(
      reviewId.data,
      remover.data,
    )
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<ReviewId, DomainError>>()
      .with({ type: 'deleted' }, () => reviewId)
      .with(
        { type: 'reviewNotFound' },
        { type: 'reviewerNotFound' },
        { type: 'notTheAuthor' },
        (unreached) =>
          Result.error(toUnreachedReviewError(unreached, reviewId.data)),
      )
      .exhaustive()
  }
}
