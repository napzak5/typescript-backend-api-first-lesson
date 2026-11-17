import {
  BulkCreateCustomersUseCase,
  type CustomerUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { BulkCreateCustomersResponse } from './_shared'

/**
 * POST /api/v1/customers/bulk - add up to a hundred customers to the ledger,
 * all or none (administrators and the members of a salon)
 */
export const bulkCreateCustomersHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  BulkCreateCustomersResponse | ProblemDetails,
  unknown
> => {
  const useCase = new BulkCreateCustomersUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.status(201).json({
          data,
          meta: responseMeta(req),
          links: { list: req.baseUrl },
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
