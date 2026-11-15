import type { CustomerUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createCustomerHandler } from './create-customer.handler'
import { createCustomerProfileHandler } from './create-customer-profile.handler'
import { deleteCustomerHandler } from './delete-customer.handler'
import { getCustomerHandler } from './get-customer.handler'
import { getCustomerProfileHandler } from './get-customer-profile.handler'
import { listCustomersHandler } from './list-customers.handler'
import { updateCustomerHandler } from './update-customer.handler'
import { updateCustomerProfileHandler } from './update-customer-profile.handler'

/**
 * Customer routes, relative to where the router is mounted. One handler per
 * implemented operation of `CustomerCrud` (the ledger) and `CustomerProfile`
 * (the signed-in customer's own record) in the TypeSpec definition. Neither
 * is public: every operation needs a signed-in user, and the use cases
 * decide who may.
 *
 * - GET    /     list            (authenticated)
 * - POST   /     create          (authenticated)
 * - GET    /me   get profile     (authenticated)
 * - POST   /me   create profile  (authenticated)
 * - PATCH  /me   update profile  (authenticated)
 * - GET    /:id  get             (authenticated)
 * - PATCH  /:id  update          (authenticated)
 * - DELETE /:id  delete          (authenticated)
 *
 * `/me` is registered before `/:id`, which would take it for an ID
 * otherwise.
 */
export const createCustomerRouter = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listCustomersHandler(dependencies, authenticated))
  router.post('/', createCustomerHandler(dependencies, authenticated))
  router.get('/me', getCustomerProfileHandler(dependencies, authenticated))
  router.post('/me', createCustomerProfileHandler(dependencies, authenticated))
  router.patch('/me', updateCustomerProfileHandler(dependencies, authenticated))
  router.get('/:id', getCustomerHandler(dependencies, authenticated))
  router.patch('/:id', updateCustomerHandler(dependencies, authenticated))
  router.delete('/:id', deleteCustomerHandler(dependencies, authenticated))

  return router
}
