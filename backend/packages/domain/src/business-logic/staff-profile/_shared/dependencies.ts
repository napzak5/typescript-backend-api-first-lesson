import type { IStaffProfileRepository } from '../../../repositories/staff-profile.repository'

/** Everything the staff profile use cases need from the outside. */
export interface StaffProfileUseCaseDependencies {
  staffProfileRepository: IStaffProfileRepository
}
