import type { CustomerStatisticsUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { getCustomerStatisticsHandler } from './get-customer-statistics.handler'

/**
 * Routes of the statistics of a customer of the ledger, relative to where
 * the router is mounted, which is below a customer
 * (`/customers/:id/statistics`): the router takes `id` from there. One
 * handler for `getStatistics` of `CustomerCrud` in the TypeSpec
 * definition, which needs a signed-in user:
 *
 * - GET  /  get the statistics of a salon and a period
 */
export const createCustomerStatisticsRouter = (
  dependencies: CustomerStatisticsUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', getCustomerStatisticsHandler(dependencies, authenticated))

  return router
}
