import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import {
  type ApiReviewHelpfulResponse,
  parseReviewId,
} from '../../models/review'
import type { DomainError } from '../../shared'
import { reviewerOf } from './_shared/authorization'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'
import { toUnmarkedReviewError } from './_shared/refusals'

export class MarkReviewHelpfulUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Marks that the signed-in customer found a review helpful, once, and
   * answers how many customers did. Whether the actor marks reviews is
   * decided before the ID is read.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiReviewHelpfulResponse, DomainError>> {
    const reviewer = reviewerOf(actor)
    if (reviewer.type === 'error') {
      return reviewer
    }
    const reviewId = parseReviewId(id)
    if (reviewId.type === 'error') {
      return reviewId
    }

    const marked = await this.dependencies.reviewRepository.markHelpful(
      reviewId.data,
      reviewer.data,
    )
    if (marked.type === 'error') {
      return marked
    }

    return match(marked.data)
      .returnType<Result<ApiReviewHelpfulResponse, DomainError>>()
      .with({ type: 'marked' }, ({ helpfulCount }) =>
        Result.success({ helpfulCount }),
      )
      .with(
        { type: 'reviewNotFound' },
        { type: 'reviewerNotFound' },
        { type: 'ownReview' },
        (unmarked) =>
          Result.error(toUnmarkedReviewError(unmarked, reviewId.data)),
      )
      .exhaustive()
  }
}
