import {
  type ProductUseCaseDependencies,
  UpdateProductUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type ProductParams,
  productLinks,
  type UpdateProductResponse,
} from './_shared'

/**
 * PATCH /api/v1/salons/:salonId/products/:id - change the given
 * properties of a product (administrators, and the owner and
 * managers of the salon)
 */
export const updateProductHandler = (
  dependencies: ProductUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  ProductParams,
  UpdateProductResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateProductUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(
      actor,
      req.params.salonId,
      req.params.id,
      req.body,
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
