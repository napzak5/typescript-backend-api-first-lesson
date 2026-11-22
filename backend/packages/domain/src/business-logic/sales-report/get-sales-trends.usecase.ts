import { Result } from '@beauty-salon-backend/utility'
import { SalesReportReadMapper } from '../../mappers/read/sales-report.mapper'
import { SalesReportWriteMapper } from '../../mappers/write/sales-report.mapper'
import type { Actor } from '../../models/auth'
import type { ApiSalesTrendsResponse } from '../../models/sales-report'
import { salesTrendsGetRequestSchema } from '../../schemas/sales-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { salesReportReachOf } from './_shared/authorization'
import type { SalesReportUseCaseDependencies } from './_shared/dependencies'
import { figuresOf } from './_shared/figures'

const MESSAGE = 'Invalid sales trends'

export class GetSalesTrendsUseCase {
  constructor(private readonly dependencies: SalesReportUseCaseDependencies) {}

  /** The sales of a period cut into days, weeks or months (`toApiSalesTrends`). */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<ApiSalesTrendsResponse, DomainError>> {
    const reach = salesReportReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(salesTrendsGetRequestSchema, query, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { period, unit } = SalesReportWriteMapper.fromTrendsGetRequest(
      request.data,
    )

    return Result.map(
      await figuresOf(this.dependencies, reach, period, MESSAGE),
      ({ days }) => SalesReportReadMapper.toApiSalesTrends(period, unit, days),
    )
  }
}
