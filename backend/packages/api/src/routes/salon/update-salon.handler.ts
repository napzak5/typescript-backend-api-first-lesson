import {
  type SalonUseCaseDependencies,
  UpdateSalonUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { salonLinks, type UpdateSalonResponse } from './_shared'

/**
 * PATCH /api/v1/salons/:id - change the given properties of a salon
 */
export const updateSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<
  { id: string },
  UpdateSalonResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id, req.body)

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
