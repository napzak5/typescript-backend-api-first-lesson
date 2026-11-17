import {
  BulkDeleteCustomersUseCase,
  type CustomerUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { BulkDeleteCustomersResponse } from './_shared'

/**
 * DELETE /api/v1/customers/bulk - delete up to a hundred customers, all or
 * none (the rows are kept and hidden; administrators, and the owner and the
 * managers of a salon)
 */
export const bulkDeleteCustomersHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  BulkDeleteCustomersResponse | ProblemDetails,
  unknown
> => {
  const useCase = new BulkDeleteCustomersUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.status(200).json({
          data,
          meta: responseMeta(req),
          links: { list: req.baseUrl },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
