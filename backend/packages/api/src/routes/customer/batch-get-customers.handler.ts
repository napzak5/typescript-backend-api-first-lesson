import {
  BatchGetCustomersUseCase,
  type CustomerUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { BatchGetCustomersResponse } from './_shared'

/**
 * POST /api/v1/customers/batch/get - the customers of up to a hundred IDs,
 * in their order (administrators and the members of a salon)
 */
export const batchGetCustomersHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  BatchGetCustomersResponse | ProblemDetails,
  unknown
> => {
  const useCase = new BatchGetCustomersUseCase(dependencies)

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
