import {
  CalculateSaleUseCase,
  type SaleUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CalculateSaleResponse, saleCalculationLinks } from './_shared'

/**
 * POST /api/v1/sales/calculate - tell what a sale would come to before it
 * is entered; nothing is written (administrators and the members of the
 * salon the request names)
 */
export const calculateSaleHandler = (
  dependencies: SaleUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CalculateSaleResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CalculateSaleUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: saleCalculationLinks(req.baseUrl),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
