import {
  type CustomerUseCaseDependencies,
  ExportCustomerDataUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { CustomerParams } from './_shared'

/**
 * GET /api/v1/customers/:id/export - everything held of a customer as one
 * JSON file (administrators, owners and managers). The file is the body of
 * the response: `res.attachment` names it in `Content-Disposition` and
 * gives it the type of its extension, `application/json; charset=utf-8`.
 * An error is a problem response, as for every other operation.
 */
export const exportCustomerDataHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<CustomerParams, string | ProblemDetails> => {
  const useCase = new ExportCustomerDataUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.attachment(data.fileName).send(data.content)
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
