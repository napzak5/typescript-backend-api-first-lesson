import {
  GetProductUseCase,
  type ProductUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type GetProductResponse,
  type ProductParams,
  productLinks,
} from './_shared'

/**
 * GET /api/v1/salons/:salonId/products/:id - get one product of a salon
 * (administrators and the members of the salon)
 */
export const getProductHandler = (
  dependencies: ProductUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<ProductParams, GetProductResponse | ProblemDetails> => {
  const useCase = new GetProductUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
    )

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: productLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
