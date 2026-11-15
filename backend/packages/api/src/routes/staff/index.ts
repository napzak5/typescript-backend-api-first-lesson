import type { StaffUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createStaffHandler } from './create-staff.handler'
import { deleteStaffHandler } from './delete-staff.handler'
import { getStaffHandler } from './get-staff.handler'
import { listStaffHandler } from './list-staff.handler'
import { updateStaffHandler } from './update-staff.handler'

/**
 * Routes of the staff ledger, relative to where the router is mounted, which
 * is below a salon (`/salons/:salonId/staff`): the router takes `salonId`
 * from there. One handler per implemented operation of `StaffCrud` in the
 * TypeSpec definition. Every one of them needs a signed-in user:
 *
 * - GET    /     list
 * - POST   /     create
 * - GET    /:id  get
 * - PATCH  /:id  update
 * - DELETE /:id  delete
 */
export const createStaffRouter = (
  dependencies: StaffUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', listStaffHandler(dependencies, authenticated))
  router.post('/', createStaffHandler(dependencies, authenticated))
  router.get('/:id', getStaffHandler(dependencies, authenticated))
  router.patch('/:id', updateStaffHandler(dependencies, authenticated))
  router.delete('/:id', deleteStaffHandler(dependencies, authenticated))

  return router
}
