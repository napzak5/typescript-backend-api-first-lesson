import type { Result } from '@beauty-salon-backend/utility'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type {
  DbNewStaffSchedule,
  DbStaffSchedule,
} from '../models/staff-schedule'
import type { DomainError } from '../shared'

/**
 * Persistence of the schedule of a staff member: all the rows of
 * `staff_schedules` that belong to them. Both methods are given the salon
 * and resolve to null when the salon has no such staff member, or has one
 * that is deleted. Whether the salon itself exists is not looked at here.
 *
 * The rows come in one order: the weekly ones from Monday to Sunday, then
 * the ones for single days from the earliest date on.
 */
export interface IStaffScheduleRepository {
  findByStaff(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<DbStaffSchedule[] | null, DomainError>>

  /**
   * Puts the given rows in the place of all the rows of the staff member,
   * or changes nothing. Of two calls that arrive together, the rows of one
   * stay, never a mixture of both.
   */
  replace(
    salonId: SalonId,
    staffId: StaffId,
    schedules: DbNewStaffSchedule[],
  ): Promise<Result<DbStaffSchedule[] | null, DomainError>>
}
