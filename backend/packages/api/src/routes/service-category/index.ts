import type { ServiceCategoryUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createServiceCategoryHandler } from './create-service-category.handler'
import { deleteServiceCategoryHandler } from './delete-service-category.handler'
import { getServiceCategoryHandler } from './get-service-category.handler'
import { listServiceCategoriesHandler } from './list-service-categories.handler'
import { updateServiceCategoryHandler } from './update-service-category.handler'

/**
 * Service category routes, relative to where the router is mounted, which is
 * below a salon (`/salons/:salonId/service-categories`): the router takes
 * `salonId` from there. One handler per operation of `ServiceCategoryCrud`
 * in the TypeSpec definition. Reading is public; the operations that change
 * the menu need a signed-in user:
 *
 * - GET    /     list
 * - POST   /     create  (authenticated)
 * - GET    /:id  get
 * - PATCH  /:id  update  (authenticated)
 * - DELETE /:id  delete  (authenticated)
 */
export const createServiceCategoryRouter = (
  dependencies: ServiceCategoryUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', listServiceCategoriesHandler(dependencies))
  router.post('/', createServiceCategoryHandler(dependencies, authenticated))
  router.get('/:id', getServiceCategoryHandler(dependencies))
  router.patch(
    '/:id',
    updateServiceCategoryHandler(dependencies, authenticated),
  )
  router.delete(
    '/:id',
    deleteServiceCategoryHandler(dependencies, authenticated),
  )

  return router
}
