import {
  AcknowledgeInventoryAlertUseCase,
  type InventoryAlertUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import {
  type AcknowledgeInventoryAlertResponse,
  inventoryAlertLinks,
} from './_shared'

/**
 * POST /api/v1/inventory-alerts/acknowledge - record that the actor saw to
 * an alert of the stock that is there now (administrators, and the members
 * of the salon of its product)
 */
export const acknowledgeInventoryAlertHandler = (
  dependencies: InventoryAlertUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  AcknowledgeInventoryAlertResponse | ProblemDetails,
  unknown
> => {
  const useCase = new AcknowledgeInventoryAlertUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: inventoryAlertLinks(req.baseUrl, data.salonId),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
