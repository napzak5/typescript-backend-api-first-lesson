import type { StaffProfileUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { getOwnStaffProfileHandler } from './get-own-staff-profile.handler'
import { getStaffProfileHandler } from './get-staff-profile.handler'
import { listStaffProfilesHandler } from './list-staff-profiles.handler'
import { updateOwnStaffProfileHandler } from './update-own-staff-profile.handler'

/**
 * Routes of the staff profiles, relative to where the router is mounted.
 * One handler per operation of `StaffProfile` and of `StaffOwnProfile` in
 * the TypeSpec definition. The list and the get are public: the profile is
 * what customers are shown of a staff member. The two of `/me` need a
 * signed-in user, whose account says which profile:
 *
 * - GET   /     list
 * - GET   /me   get own     (authenticated)
 * - PATCH /me   update own  (authenticated)
 * - GET   /:id  get
 *
 * `/me` is registered before `/:id`, which would take it for an ID
 * otherwise.
 */
export const createStaffProfileRouter = (
  dependencies: StaffProfileUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listStaffProfilesHandler(dependencies))
  router.get('/me', getOwnStaffProfileHandler(dependencies, authenticated))
  router.patch('/me', updateOwnStaffProfileHandler(dependencies, authenticated))
  router.get('/:id', getStaffProfileHandler(dependencies))

  return router
}
