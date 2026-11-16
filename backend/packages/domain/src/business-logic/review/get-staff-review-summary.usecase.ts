import { Result } from '@beauty-salon-backend/utility'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import type { ApiReviewSummaryResponse } from '../../models/review'
import { parseStaffIdOfPath } from '../../models/staff'
import { type DomainError, DomainErrors } from '../../shared'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'

export class GetStaffReviewSummaryUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * What the reviews that name a staff member come to, counted when it is
   * asked for. Anyone may read it; a deleted staff member, and one of a
   * deleted salon, are answered as one who is not there.
   */
  async execute(
    staffId: unknown,
  ): Promise<Result<ApiReviewSummaryResponse, DomainError>> {
    const id = parseStaffIdOfPath(staffId)
    if (id.type === 'error') {
      return id
    }

    const tally = await this.dependencies.reviewRepository.staffTally(id.data)
    if (tally.type === 'error') {
      return tally
    }
    if (tally.data === null) {
      return Result.error(DomainErrors.notFound('Staff member', id.data))
    }

    return ReviewReadMapper.toApiReviewSummary(tally.data)
  }
}
