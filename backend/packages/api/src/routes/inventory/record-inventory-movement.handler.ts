import {
  type InventoryUseCaseDependencies,
  RecordInventoryMovementUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { movementLinks, type RecordInventoryMovementResponse } from './_shared'

/**
 * POST /api/v1/inventory/movement - record a stock movement of a stock row
 * and move its stock by it (administrators, and the owner and managers of
 * its salon; its staff for a purchase, a sale, a use and a return)
 */
export const recordInventoryMovementHandler = (
  dependencies: InventoryUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  RecordInventoryMovementResponse | ProblemDetails,
  unknown
> => {
  const useCase = new RecordInventoryMovementUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links:
            data.inventoryId === null
              ? null
              : movementLinks(req.baseUrl, data.inventoryId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
