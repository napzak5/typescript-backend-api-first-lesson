import { Result } from '@beauty-salon-backend/utility'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/api'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import { ReviewWriteMapper } from '../../mappers/write/review.mapper'
import type { ApiPage } from '../../models/page'
import type { ApiReviewResponse } from '../../models/review'
import { reviewSearchRequestSchema } from '../../schemas/review.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = reviewMessages.invalidReviewSearch

export class ListReviewsUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Lists the reviews of the salons that are not deleted, those the
   * filters leave, newest first unless another order is asked for. Anyone
   * may. The cursor of a page is the ID of its last review; one that names
   * no review that is listed is refused, so the answer does not tell that
   * a review of a deleted salon is there.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiPage<ApiReviewResponse>, DomainError>> {
    const request = parseWith(reviewSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const criteria = ReviewWriteMapper.fromSearchRequest(request.data)

    const listed = await this.dependencies.reviewRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          notFound('cursor', 'a review that is listed'),
        ]),
      )
    }

    return ReviewReadMapper.toApiReviewPage(listed.data, criteria)
  }
}
