import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { salesReportGetRequestSchema } from '../../schemas/sales-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { salesReportReachOf } from './_shared/authorization'
import type { SalesReportUseCaseDependencies } from './_shared/dependencies'
import { exportOf, type SalesReportFile } from './_shared/export'
import { figuresOf } from './_shared/figures'

const MESSAGE = 'Invalid sales report'

export class ExportSalesReportUseCase {
  constructor(private readonly dependencies: SalesReportUseCaseDependencies) {}

  /**
   * The sales of a period as a CSV file, a line for every day (`exportOf`).
   * The query, the reach and the figures are those of the report of the
   * period; the file is made at every request and stored nowhere.
   */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<SalesReportFile, DomainError>> {
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
      ({ days }) => exportOf(request.data, days),
    )
  }
}
