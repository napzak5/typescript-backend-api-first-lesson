import type { SalonUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import { createSalonHandler } from './create-salon.handler'
import { deleteSalonHandler } from './delete-salon.handler'
import { getSalonHandler } from './get-salon.handler'
import { listSalonsHandler } from './list-salons.handler'
import { updateSalonHandler } from './update-salon.handler'

/**
 * Salon routes, relative to where the router is mounted. One handler per
 * operation of `SalonCrud` in the TypeSpec definition:
 *
 * - GET    /     list
 * - POST   /     create
 * - GET    /:id  get
 * - PATCH  /:id  update
 * - DELETE /:id  delete
 */
export const createSalonRouter = (
  dependencies: SalonUseCaseDependencies,
): Router => {
  const router = Router()

  router.get('/', listSalonsHandler(dependencies))
  router.post('/', createSalonHandler(dependencies))
  router.get('/:id', getSalonHandler(dependencies))
  router.patch('/:id', updateSalonHandler(dependencies))
  router.delete('/:id', deleteSalonHandler(dependencies))

  return router
}
