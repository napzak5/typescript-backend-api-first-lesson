import type { CustomerDeletionRequestUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { cancelCustomerDeletionRequestHandler } from './cancel-customer-deletion-request.handler'
import { executeCustomerDeletionRequestsHandler } from './execute-customer-deletion-requests.handler'
import { getCustomerDeletionRequestHandler } from './get-customer-deletion-request.handler'
import { requestCustomerDeletionHandler } from './request-customer-deletion.handler'

/**
 * Routes of the requests of customers to erase their data, relative to
 * where the customer routes are mounted. Handlers for `requestDeletion`,
 * `getDeletionRequest`, `cancelDeletionRequest` and
 * `executeDeletionRequests` of `CustomerCrud` in the TypeSpec definition,
 * which need a signed-in user:
 *
 * - POST   /deletion-requests/execute  erase the data of the requests due
 * - POST   /:id/deletion-request       take a request
 * - GET    /:id/deletion-request       the latest request
 * - DELETE /:id/deletion-request       cancel the pending request
 *
 * A path that is not one of these falls through to the routers mounted
 * after this one.
 */
export const createCustomerDeletionRequestRouter = (
  dependencies: CustomerDeletionRequestUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()
  router.post(
    '/deletion-requests/execute',
    executeCustomerDeletionRequestsHandler(dependencies, authenticated),
  )
  router.post(
    '/:id/deletion-request',
    requestCustomerDeletionHandler(dependencies, authenticated),
  )
  router.get(
    '/:id/deletion-request',
    getCustomerDeletionRequestHandler(dependencies, authenticated),
  )
  router.delete(
    '/:id/deletion-request',
    cancelCustomerDeletionRequestHandler(dependencies, authenticated),
  )
  return router
}
