import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiSalesByCategoryResponse } from '../../models/sales-report'
import { salesReportGetRequestSchema } from '../../schemas/sales-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { salesReportReachOf } from './_shared/authorization'
import type { SalesReportUseCaseDependencies } from './_shared/dependencies'
import { figuresOf } from './_shared/figures'
import { categoryRowsOf } from './_shared/report'

const MESSAGE = 'Invalid sales report'

export class GetSalesByCategoryUseCase {
  constructor(private readonly dependencies: SalesReportUseCaseDependencies) {}

  /** Every kind of category that has a service line in the sales of a period (`categoryRowsOf`). */
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

    return Result.map(
      await figuresOf(this.dependencies, reach, request.data, MESSAGE),
      ({ categories }) => categoryRowsOf(categories),
    )
  }
}
