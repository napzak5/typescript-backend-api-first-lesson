import type { CustomerUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { batchGetCustomersHandler } from './batch-get-customers.handler'
import { bulkCreateCustomersHandler } from './bulk-create-customers.handler'
import { bulkDeleteCustomersHandler } from './bulk-delete-customers.handler'
import { bulkUpdateCustomersHandler } from './bulk-update-customers.handler'
import { createCustomerHandler } from './create-customer.handler'
import { createCustomerProfileHandler } from './create-customer-profile.handler'
import { deleteCustomerHandler } from './delete-customer.handler'
import { exportCustomerDataHandler } from './export-customer-data.handler'
import { exportCustomersHandler } from './export-customers.handler'
import { getCustomerHandler } from './get-customer.handler'
import { getCustomerProfileHandler } from './get-customer-profile.handler'
import { listCustomersHandler } from './list-customers.handler'
import { mergeCustomersHandler } from './merge-customers.handler'
import { restoreCustomerHandler } from './restore-customer.handler'
import { updateCustomerHandler } from './update-customer.handler'
import { updateCustomerProfileHandler } from './update-customer-profile.handler'

/**
 * Customer routes, relative to where the router is mounted. One handler per
 * implemented operation of `CustomerCrud` (the ledger) and `CustomerProfile`
 * (the signed-in customer's own record) in the TypeSpec definition. Neither
 * is public: every operation needs a signed-in user, and the use cases
 * decide who may.
 *
 * - GET    /           list            (authenticated)
 * - POST   /           create          (authenticated)
 * - POST   /batch/get  batch get       (authenticated)
 * - POST   /bulk       bulk create     (authenticated)
 * - PATCH  /bulk       bulk update     (authenticated)
 * - DELETE /bulk       bulk delete     (authenticated)
 * - GET    /export     export as CSV   (authenticated)
 * - POST   /merge      merge           (authenticated)
 * - GET    /me         get profile     (authenticated)
 * - POST   /me         create profile  (authenticated)
 * - PATCH  /me         update profile  (authenticated)
 * - GET    /:id        get             (authenticated)
 * - PATCH  /:id        update          (authenticated)
 * - DELETE /:id        delete          (authenticated)
 * - GET    /:id/export   export data (authenticated)
 * - POST   /:id/restore  restore     (authenticated)
 *
 * `/bulk`, `/export` and `/me` are registered before `/:id`, which would
 * take them for an ID otherwise.
 */
export const createCustomerRouter = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listCustomersHandler(dependencies, authenticated))
  router.post('/', createCustomerHandler(dependencies, authenticated))
  router.post(
    '/batch/get',
    batchGetCustomersHandler(dependencies, authenticated),
  )
  router.post('/bulk', bulkCreateCustomersHandler(dependencies, authenticated))
  router.patch('/bulk', bulkUpdateCustomersHandler(dependencies, authenticated))
  router.delete(
    '/bulk',
    bulkDeleteCustomersHandler(dependencies, authenticated),
  )
  router.get('/export', exportCustomersHandler(dependencies, authenticated))
  router.post('/merge', mergeCustomersHandler(dependencies, authenticated))
  router.get('/me', getCustomerProfileHandler(dependencies, authenticated))
  router.post('/me', createCustomerProfileHandler(dependencies, authenticated))
  router.patch('/me', updateCustomerProfileHandler(dependencies, authenticated))
  router.get('/:id', getCustomerHandler(dependencies, authenticated))
  router.patch('/:id', updateCustomerHandler(dependencies, authenticated))
  router.delete('/:id', deleteCustomerHandler(dependencies, authenticated))
  router.get(
    '/:id/export',
    exportCustomerDataHandler(dependencies, authenticated),
  )
  router.post(
    '/:id/restore',
    restoreCustomerHandler(dependencies, authenticated),
  )

  return router
}
