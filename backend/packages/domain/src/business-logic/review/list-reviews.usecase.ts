import { Result } from '@beauty-salon-backend/utility'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import type { ApiPaginationMeta } from '../../models/page'
import type { ApiReviewResponse } from '../../models/review'
import { reviewSearchRequestSchema } from '../../schemas/review.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid review search'

export type ReviewPage = {
  data: ApiReviewResponse[]
  meta: ApiPaginationMeta
}

export class ListReviewsUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Lists the reviews of the salons that are not deleted, those the
   * filters leave, newest first unless another order is asked for. Anyone
   * may. The cursor of a page is the ID of its last review; one that names
   * no review that is listed is refused, so the answer does not tell that
   * a review of a deleted salon is there.
   */
  async execute(input: unknown): Promise<Result<ReviewPage, DomainError>> {
    const request = parseWith(reviewSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { cursor } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.reviewRepository.list({
      limit,
      after: cursor ?? null,
      sortBy: request.data.sortBy ?? 'recent',
      salonId: request.data.salonId ?? null,
      staffId: request.data.staffId ?? null,
      customerId: request.data.customerId ?? null,
      bookingId: request.data.bookingId ?? null,
      isVerified: request.data.isVerified ?? null,
      minRating: request.data.minRating ?? null,
      maxRating: request.data.maxRating ?? null,
    })
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

    const { reviews, total, hasMore } = listed.data
    return Result.map(ReviewReadMapper.toApiReviews(reviews), (data) => ({
      data,
      meta: {
        total,
        limit,
        hasMore,
        cursor: cursor ?? null,
        nextCursor: hasMore ? (reviews.at(-1)?.id ?? null) : null,
        // Pages are only walked forwards.
        prevCursor: null,
      },
    }))
  }
}
