import {
  type CustomerUseCaseDependencies,
  MergeCustomersUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { customerLinks, type MergeCustomersResponse } from './_shared'

/**
 * POST /api/v1/customers/merge - merge a customer registered twice into
 * one, and answer with the one kept (administrators, and the owner and the
 * managers of a salon)
 */
export const mergeCustomersHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  MergeCustomersResponse | ProblemDetails,
  unknown
> => {
  const useCase = new MergeCustomersUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: customerLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
