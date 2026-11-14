import type { SalonUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createSalonHandler } from './create-salon.handler'
import { deleteSalonHandler } from './delete-salon.handler'
import { getSalonHandler } from './get-salon.handler'
import { listSalonsHandler } from './list-salons.handler'
import { updateSalonHandler } from './update-salon.handler'

/**
 * Salon routes, relative to where the router is mounted. One handler per
 * operation of `SalonCrud` in the TypeSpec definition. Reading is public;
 * the operations that change a salon need a signed-in user:
 *
 * - GET    /     list
 * - POST   /     create  (authenticated)
 * - GET    /:id  get
 * - PATCH  /:id  update  (authenticated)
 * - DELETE /:id  delete  (authenticated)
 */
export const createSalonRouter = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listSalonsHandler(dependencies))
  router.post('/', createSalonHandler(dependencies, authenticated))
  router.get('/:id', getSalonHandler(dependencies))
  router.patch('/:id', updateSalonHandler(dependencies, authenticated))
  router.delete('/:id', deleteSalonHandler(dependencies, authenticated))

  return router
}
