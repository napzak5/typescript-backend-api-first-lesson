import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IStaffScheduleRepository } from '../../../repositories/staff-schedule.repository'

/** Everything the use cases of the staff schedules need from the outside. */
export interface StaffScheduleUseCaseDependencies {
  staffScheduleRepository: IStaffScheduleRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
}
