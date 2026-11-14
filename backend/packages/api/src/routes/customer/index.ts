import type { CustomerUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createCustomerHandler } from './create-customer.handler'
import { deleteCustomerHandler } from './delete-customer.handler'
import { getCustomerHandler } from './get-customer.handler'
import { listCustomersHandler } from './list-customers.handler'
import { updateCustomerHandler } from './update-customer.handler'

/**
 * Customer routes, relative to where the router is mounted. One handler per
 * implemented operation of `CustomerCrud` in the TypeSpec definition. The
 * ledger is not public: every operation needs a signed-in user, and the use
 * cases decide who may.
 *
 * - GET    /     list    (authenticated)
 * - POST   /     create  (authenticated)
 * - GET    /:id  get     (authenticated)
 * - PATCH  /:id  update  (authenticated)
 * - DELETE /:id  delete  (authenticated)
 */
export const createCustomerRouter = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listCustomersHandler(dependencies, authenticated))
  router.post('/', createCustomerHandler(dependencies, authenticated))
  router.get('/:id', getCustomerHandler(dependencies, authenticated))
  router.patch('/:id', updateCustomerHandler(dependencies, authenticated))
  router.delete('/:id', deleteCustomerHandler(dependencies, authenticated))

  return router
}
