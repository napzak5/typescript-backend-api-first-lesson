import type { CustomerVersionUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { getCustomerHistoryHandler } from './get-customer-history.handler'
import { getCustomerVersionHandler } from './get-customer-version.handler'

/**
 * Routes of the versions of a customer of the ledger, relative to where the
 * router is mounted, which is a customer (`/customers/:id`): the router
 * takes `id` from there. Handlers for `getHistory` and `getVersion` of
 * `CustomerCrud` in the TypeSpec definition, which need a signed-in user:
 *
 * - GET  /history            the versions, newest first
 * - GET  /versions/:version  one version
 *
 * A path that is not one of these falls through to the routers mounted
 * after this one.
 */
export const createCustomerVersionRouter = (
  dependencies: CustomerVersionUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })
  router.get('/history', getCustomerHistoryHandler(dependencies, authenticated))
  router.get(
    '/versions/:version',
    getCustomerVersionHandler(dependencies, authenticated),
  )
  return router
}
