import { Result } from '@beauty-salon-backend/utility'
import { SalesReportReadMapper } from '../../mappers/read/sales-report.mapper'
import { SalesReportWriteMapper } from '../../mappers/write/sales-report.mapper'
import type { Actor } from '../../models/auth'
import type { ApiSalesByCategoryResponse } from '../../models/sales-report'
import { salesReportGetRequestSchema } from '../../schemas/sales-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { salesReportReachOf } from './_shared/authorization'
import type { SalesReportUseCaseDependencies } from './_shared/dependencies'
import { figuresOf } from './_shared/figures'

const MESSAGE = 'Invalid sales report'

export class GetSalesByCategoryUseCase {
  constructor(private readonly dependencies: SalesReportUseCaseDependencies) {}

  /** Every kind of category that has a service line in the sales of a period (`toApiSalesByCategory`). */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<ApiSalesByCategoryResponse[], DomainError>> {
    const reach = salesReportReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(salesReportGetRequestSchema, query, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const period = SalesReportWriteMapper.fromGetRequest(request.data)

    return Result.map(
      await figuresOf(this.dependencies, reach, period, MESSAGE),
      ({ categories }) =>
        SalesReportReadMapper.toApiSalesByCategory(categories),
    )
  }
}
