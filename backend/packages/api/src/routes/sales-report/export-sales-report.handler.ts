import {
  ExportSalesReportUseCase,
  type SalesReportUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'

/**
 * GET /api/v1/sales-reports/export - the sales of a period of a salon as
 * a CSV file, a line for every day (administrators, and the owner and the
 * managers of the salon). The file is the body of the response:
 * `res.attachment` names it in `Content-Disposition` and gives it the type
 * of its extension, `text/csv; charset=utf-8`. An error is a problem
 * response, as for every other operation.
 */
export const exportSalesReportHandler = (
  dependencies: SalesReportUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<Record<string, never>, string | ProblemDetails> => {
  const useCase = new ExportSalesReportUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that is wrong is told only to an actor who may read reports,
    // which is why the use case reads it.
    const result = await useCase.execute(actor, req.query)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.attachment(data.fileName).send(data.content)
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
