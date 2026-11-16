import { Result } from '@beauty-salon-backend/utility'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import { type ApiReviewResponse, parseReviewId } from '../../models/review'
import { type DomainError, DomainErrors } from '../../shared'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'

export class GetReviewUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * One review. Anyone may read it; a review of a deleted salon is
   * answered as one that is not there.
   */
  async execute(id: unknown): Promise<Result<ApiReviewResponse, DomainError>> {
    const reviewId = parseReviewId(id)
    if (reviewId.type === 'error') {
      return reviewId
    }

    const found = await this.dependencies.reviewRepository.findById(
      reviewId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Review', reviewId.data))
    }

    return ReviewReadMapper.toApiReview(found.data)
  }
}
