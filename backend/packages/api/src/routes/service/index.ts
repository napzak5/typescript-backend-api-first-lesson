import type { ServiceUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { bulkUpdateServicesHandler } from './bulk-update-services.handler'
import { createServiceHandler } from './create-service.handler'
import { deleteServiceHandler } from './delete-service.handler'
import { getServiceHandler } from './get-service.handler'
import { listServicesHandler } from './list-services.handler'
import { updateServiceHandler } from './update-service.handler'

/**
 * Service routes, relative to where the router is mounted, which is below a
 * salon (`/salons/:salonId/services`): the router takes `salonId` from
 * there. One handler per operation of `ServiceCrud` in the TypeSpec
 * definition. Reading is public; the operations that change the menu need a
 * signed-in user:
 *
 * - GET    /      list
 * - POST   /      create       (authenticated)
 * - PATCH  /bulk  bulk update  (authenticated)
 * - GET    /:id   get
 * - PATCH  /:id   update       (authenticated)
 * - DELETE /:id   delete       (authenticated)
 *
 * `/bulk` is registered before `/:id`, which would otherwise take `bulk`
 * for the ID of a service.
 */
export const createServiceRouter = (
  dependencies: ServiceUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', listServicesHandler(dependencies))
  router.post('/', createServiceHandler(dependencies, authenticated))
  router.patch('/bulk', bulkUpdateServicesHandler(dependencies, authenticated))
  router.get('/:id', getServiceHandler(dependencies))
  router.patch('/:id', updateServiceHandler(dependencies, authenticated))
  router.delete('/:id', deleteServiceHandler(dependencies, authenticated))

  return router
}
