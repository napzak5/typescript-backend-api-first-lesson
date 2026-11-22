import { Result } from '@beauty-salon-backend/utility'
import { salesReportMessages } from '@beauty-salon-shared/i18n/messages/api'
import { SalesReportReadMapper } from '../../mappers/read/sales-report.mapper'
import { SalesReportWriteMapper } from '../../mappers/write/sales-report.mapper'
import type { Actor } from '../../models/auth'
import type { ApiDailySalesResponse } from '../../models/sales-report'
import { dailySalesGetRequestSchema } from '../../schemas/sales-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { salesReportReachOf } from './_shared/authorization'
import type { SalesReportUseCaseDependencies } from './_shared/dependencies'
import { figuresOf } from './_shared/figures'

const MESSAGE = salesReportMessages.invalidDailySales

export class GetDailySalesUseCase {
  constructor(private readonly dependencies: SalesReportUseCaseDependencies) {}

  /** The sales of one day of a salon (`toApiDailySales`), a period of that day alone. */
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
    const day = SalesReportWriteMapper.fromDailyGetRequest(request.data)

    return Result.map(
      await figuresOf(this.dependencies, reach, day, MESSAGE),
      ({ days }) => SalesReportReadMapper.toApiDailySales(day.startDate, days),
    )
  }
}
