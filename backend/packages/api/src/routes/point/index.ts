import type { PointUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { adjustPointsHandler } from './adjust-points.handler'
import { earnPointsHandler } from './earn-points.handler'
import { expirePointsHandler } from './expire-points.handler'
import { getExpiringPointsHandler } from './get-expiring-points.handler'
import { getPointBalanceHandler } from './get-point-balance.handler'
import { listPointTransactionsHandler } from './list-point-transactions.handler'
import { usePointsHandler } from './use-points.handler'

/**
 * Point routes, relative to where the router is mounted. One handler per
 * operation of `PointCrud` in the TypeSpec definition. None is public:
 * every operation needs a signed-in user, and the use cases decide who
 * may.
 *
 * - GET  /customer/:customerId/balance       getBalance        (authenticated)
 * - GET  /customer/:customerId/transactions  listTransactions  (authenticated)
 * - POST /earn                                earn              (authenticated)
 * - POST /use                                 use               (authenticated)
 * - POST /adjust                              adjust            (authenticated)
 * - GET  /customer/:customerId/expiring      getExpiring       (authenticated)
 * - POST /expire                              expire            (authenticated)
 */
export const createPointRouter = (
  dependencies: PointUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get(
    '/customer/:customerId/balance',
    getPointBalanceHandler(dependencies, authenticated),
  )
  router.get(
    '/customer/:customerId/transactions',
    listPointTransactionsHandler(dependencies, authenticated),
  )
  router.post('/earn', earnPointsHandler(dependencies, authenticated))
  router.post('/use', usePointsHandler(dependencies, authenticated))
  router.post('/adjust', adjustPointsHandler(dependencies, authenticated))
  router.get(
    '/customer/:customerId/expiring',
    getExpiringPointsHandler(dependencies, authenticated),
  )
  router.post('/expire', expirePointsHandler(dependencies, authenticated))

  return router
}
