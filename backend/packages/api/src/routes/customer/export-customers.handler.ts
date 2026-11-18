import {
  type CustomerUseCaseDependencies,
  ExportCustomersUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import { decodeCustomerExportQuery } from './_shared'

/**
 * GET /api/v1/customers/export - the customers who match the filters of
 * the list as a CSV file (administrators, owners and managers). The file
 * is the body of the response: `res.attachment` names it in
 * `Content-Disposition` and gives it the type of its extension,
 * `text/csv; charset=utf-8`. An error is a problem response, as for every
 * other operation.
 */
export const exportCustomersHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<Record<string, never>, string | ProblemDetails> => {
  const useCase = new ExportCustomersUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may export customers.
    const result = await useCase.execute(
      actor,
      decodeCustomerExportQuery(req.query),
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.attachment(data.fileName).send(data.content)
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
