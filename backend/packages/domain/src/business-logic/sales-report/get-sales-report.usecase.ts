import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiSalesReportResponse } from '../../models/sales-report'
import { salesReportGetRequestSchema } from '../../schemas/sales-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { salesReportReachOf } from './_shared/authorization'
import type { SalesReportUseCaseDependencies } from './_shared/dependencies'
import { figuresOf } from './_shared/figures'
import { reportOf } from './_shared/report'

const MESSAGE = 'Invalid sales report'

export class GetSalesReportUseCase {
  constructor(private readonly dependencies: SalesReportUseCaseDependencies) {}

  /**
   * The report of a period of a salon (`reportOf`). Whether the actor reads
   * reports at all is decided before the query is read, and whether they
   * read those of the salon it names, once it says which salon that is.
   */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<ApiSalesReportResponse, DomainError>> {
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
      (figures) => reportOf(request.data, figures),
    )
  }
}
