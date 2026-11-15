import type { StaffScheduleUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { listStaffSchedulesHandler } from './list-staff-schedules.handler'
import { updateStaffSchedulesHandler } from './update-staff-schedules.handler'

/**
 * Routes of the schedule of a staff member, relative to where the router
 * is mounted, which is below a staff member of a salon
 * (`/salons/:salonId/staff/:id/schedules`): the router takes `salonId` and
 * `id` from there. One handler per operation of `StaffSchedules` in the
 * TypeSpec definition. Both need a signed-in user:
 *
 * - GET  /  list
 * - PUT  /  update (replaces the whole schedule)
 */
export const createStaffScheduleRouter = (
  dependencies: StaffScheduleUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', listStaffSchedulesHandler(dependencies, authenticated))
  router.put('/', updateStaffSchedulesHandler(dependencies, authenticated))

  return router
}
