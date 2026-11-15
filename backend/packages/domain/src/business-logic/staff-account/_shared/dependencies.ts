import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IStaffAccountRepository } from '../../../repositories/staff-account.repository'

/** Everything the use cases of the accounts of staff members need from the outside. */
export interface StaffAccountUseCaseDependencies {
  staffAccountRepository: IStaffAccountRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
}
