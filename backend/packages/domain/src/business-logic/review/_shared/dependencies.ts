import type { IReviewRepository } from '../../../repositories/review.repository'

/** Everything the review use cases need from the outside. */
export interface ReviewUseCaseDependencies {
  reviewRepository: IReviewRepository
}
