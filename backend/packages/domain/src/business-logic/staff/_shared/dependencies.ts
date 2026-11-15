import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IStaffRepository } from '../../../repositories/staff.repository'

/** Everything the staff use cases need from the outside. */
export interface StaffUseCaseDependencies {
  staffRepository: IStaffRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
}
