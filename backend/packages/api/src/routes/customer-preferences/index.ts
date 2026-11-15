import type { CustomerPreferencesUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { getCustomerPreferencesHandler } from './get-customer-preferences.handler'
import { getOwnCustomerPreferencesHandler } from './get-own-customer-preferences.handler'
import { updateCustomerPreferencesHandler } from './update-customer-preferences.handler'
import { updateOwnCustomerPreferencesHandler } from './update-own-customer-preferences.handler'

/**
 * Routes of the preferences of a customer of the ledger, relative to where
 * the router is mounted, which is below a customer
 * (`/customers/:id/preferences`): the router takes `id` from there. One
 * handler per operation on the preferences in `CustomerCrud` in the
 * TypeSpec definition. Both need a signed-in user:
 *
 * - GET    /  get
 * - PATCH  /  update (creates the preferences with the first change)
 */
export const createCustomerPreferencesRouter = (
  dependencies: CustomerPreferencesUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', getCustomerPreferencesHandler(dependencies, authenticated))
  router.patch(
    '/',
    updateCustomerPreferencesHandler(dependencies, authenticated),
  )

  return router
}

/**
 * Routes of the signed-in customer's own preferences, relative to where the
 * router is mounted (`/customers/me/preferences`). One handler per
 * operation on the preferences in `CustomerProfile` in the TypeSpec
 * definition. Both need a signed-in user:
 *
 * - GET    /  get
 * - PATCH  /  update
 *
 * The router is mounted before the one of the ledger, which would take
 * "me" for the ID of a customer otherwise.
 */
export const createOwnCustomerPreferencesRouter = (
  dependencies: CustomerPreferencesUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', getOwnCustomerPreferencesHandler(dependencies, authenticated))
  router.patch(
    '/',
    updateOwnCustomerPreferencesHandler(dependencies, authenticated),
  )

  return router
}
