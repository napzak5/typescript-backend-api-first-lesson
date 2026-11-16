import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiDailySalesResponse } from '../../models/sales-report'
import { dailySalesGetRequestSchema } from '../../schemas/sales-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { salesReportReachOf } from './_shared/authorization'
import type { SalesReportUseCaseDependencies } from './_shared/dependencies'
import { figuresOf } from './_shared/figures'
import { dailyOf } from './_shared/report'

const MESSAGE = 'Invalid daily sales'

export class GetDailySalesUseCase {
  constructor(private readonly dependencies: SalesReportUseCaseDependencies) {}

  /** The sales of one day of a salon (`dailyOf`), a period of that day alone. */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<ApiDailySalesResponse, DomainError>> {
    const reach = salesReportReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(dailySalesGetRequestSchema, query, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { salonId, date } = request.data

    return Result.map(
      await figuresOf(
        this.dependencies,
        reach,
        { salonId, startDate: date, endDate: date },
        MESSAGE,
      ),
      ({ days }) => dailyOf(date, days),
    )
  }
}
