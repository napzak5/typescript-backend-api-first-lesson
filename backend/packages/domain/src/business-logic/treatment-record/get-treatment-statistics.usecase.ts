import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiTreatmentStatisticsResponse } from '../../models/treatment-record'
import { treatmentStatisticsGetRequestSchema } from '../../schemas/treatment-record.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { notFound } from '../booking/_shared/plan'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'
import { statisticsOf } from './_shared/statistics'

const MESSAGE = 'Invalid treatment statistics'

export class GetTreatmentStatisticsUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * The statistics of the records of a salon in a period
   * (`statisticsOf`), for those who read the records of the salon. Whether
   * the actor reads records at all is decided before the query is read; a
   * salon the actor does not reach is refused before it is looked up, so
   * whether it is there is told only to the administrators.
   */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<ApiTreatmentStatisticsResponse, DomainError>> {
    const reach = treatmentRecordReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(
      treatmentStatisticsGetRequestSchema,
      query,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { salonId, startDate, endDate } = request.data
    if (!isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const figures =
      await this.dependencies.treatmentRecordRepository.findFigures({
        salonId,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
      })
    if (figures.type === 'error') {
      return figures
    }

    return figures.data === null
      ? Result.error(
          DomainErrors.validation(MESSAGE, [notFound('salonId', 'a salon')]),
        )
      : Result.success(statisticsOf(figures.data))
  }
}
