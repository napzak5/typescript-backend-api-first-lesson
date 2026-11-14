import {
  GetSalonUseCase,
  type SalonUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type GetSalonResponse, salonLinks } from './_shared'

/**
 * GET /api/v1/salons/:id - get one salon with its calendar
 */
export const getSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<{ id: string }, GetSalonResponse | ProblemDetails> => {
  const useCase = new GetSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: salonLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
