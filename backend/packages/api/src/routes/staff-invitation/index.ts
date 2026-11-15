import type { StaffInvitationUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { neverStored } from '../../shared/never-stored'
import { acceptStaffInvitationHandler } from './accept-staff-invitation.handler'
import { createStaffInvitationHandler } from './create-staff-invitation.handler'
import { deleteStaffInvitationHandler } from './delete-staff-invitation.handler'
import { getStaffInvitationHandler } from './get-staff-invitation.handler'
import { verifyStaffInvitationHandler } from './verify-staff-invitation.handler'

/**
 * Routes of the invitation of a staff member for whoever invites, relative
 * to where the router is mounted, which is below a staff member of a salon
 * (`/salons/:salonId/staff/:id/invitation`): the router takes `salonId`
 * and `id` from there. One handler per operation of `StaffInvitations` in
 * the TypeSpec definition. All need a signed-in user:
 *
 * - GET    /  get
 * - POST   /  create (in the place of the invitation the staff member holds)
 * - DELETE /  delete
 */
export const createStaffInvitationRouter = (
  dependencies: StaffInvitationUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', getStaffInvitationHandler(dependencies, authenticated))
  router.post('/', createStaffInvitationHandler(dependencies, authenticated))
  router.delete('/', deleteStaffInvitationHandler(dependencies, authenticated))

  return router
}

/**
 * Routes of an invitation for whoever was invited, relative to where the
 * router is mounted (`/auth/staff-invitation`). They are operations of
 * `AuthCrud` in the TypeSpec definition, and the holder of a token has no
 * account to sign in to yet:
 *
 * - POST /verify  verifyStaffInvitation
 * - POST /accept  acceptStaffInvitation
 */
export const createStaffInvitationAcceptanceRouter = (
  dependencies: StaffInvitationUseCaseDependencies,
): Router => {
  const router = Router()

  router.use(neverStored)

  router.post('/verify', verifyStaffInvitationHandler(dependencies))
  router.post('/accept', acceptStaffInvitationHandler(dependencies))

  return router
}
