import type { StaffProfileUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import { getStaffProfileHandler } from './get-staff-profile.handler'
import { listStaffProfilesHandler } from './list-staff-profiles.handler'

/**
 * Routes of the staff profiles, relative to where the router is mounted.
 * One handler per operation of `StaffProfile` in the TypeSpec definition.
 * Both are public: the profile is what customers are shown of a staff
 * member.
 *
 * - GET /     list
 * - GET /:id  get
 */
export const createStaffProfileRouter = (
  dependencies: StaffProfileUseCaseDependencies,
): Router => {
  const router = Router()

  router.get('/', listStaffProfilesHandler(dependencies))
  router.get('/:id', getStaffProfileHandler(dependencies))

  return router
}
