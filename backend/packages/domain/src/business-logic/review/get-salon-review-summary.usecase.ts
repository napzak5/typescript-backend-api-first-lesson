import { Result } from '@beauty-salon-backend/utility'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import type { ApiReviewSummaryResponse } from '../../models/review'
import { parseSalonIdOfPath } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'

export class GetSalonReviewSummaryUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * What the reviews of a salon come to, counted when it is asked for:
   * the average and the total are the rating and the review count of the
   * salon. Anyone may read it; a deleted salon is answered as one that is
   * not there.
   */
  async execute(
    salonId: unknown,
  ): Promise<Result<ApiReviewSummaryResponse, DomainError>> {
    const id = parseSalonIdOfPath(salonId)
    if (id.type === 'error') {
      return id
    }

    const tally = await this.dependencies.reviewRepository.salonTally(id.data)
    if (tally.type === 'error') {
      return tally
    }
    if (tally.data === null) {
      return Result.error(DomainErrors.notFound('Salon', id.data))
    }

    return ReviewReadMapper.toApiReviewSummary(tally.data)
  }
}
