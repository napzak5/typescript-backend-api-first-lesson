import type { StaffAccountUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { deleteStaffAccountHandler } from './delete-staff-account.handler'
import { getStaffAccountHandler } from './get-staff-account.handler'
import { updateStaffAccountHandler } from './update-staff-account.handler'

/**
 * Routes of the account of a staff member, relative to where the router is
 * mounted, which is below a staff member of a salon
 * (`/salons/:salonId/staff/:id/account`): the router takes `salonId` and
 * `id` from there. One handler per operation of `StaffAccounts` in the
 * TypeSpec definition. All need a signed-in user:
 *
 * - GET    /  get
 * - PATCH  /  update (the role)
 * - DELETE /  delete (unlinks; neither the account nor the staff member is deleted)
 */
export const createStaffAccountRouter = (
  dependencies: StaffAccountUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', getStaffAccountHandler(dependencies, authenticated))
  router.patch('/', updateStaffAccountHandler(dependencies, authenticated))
  router.delete('/', deleteStaffAccountHandler(dependencies, authenticated))

  return router
}
