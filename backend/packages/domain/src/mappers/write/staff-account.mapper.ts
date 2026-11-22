import type { ApiStaffAccountUpdateRequest } from '../../models/staff-account'
import type { StaffAccountChanges } from '../../repositories/staff-account.repository'

/**
 * API request → what the repository takes. A role is the same word in the
 * API and in the database, so the changes are the request as it is: the
 * mapper is where the compiler checks that the two agree.
 */
export const StaffAccountWriteMapper = {
  /** Only the properties present in the request become changes. */
  fromUpdateRequest(
    request: ApiStaffAccountUpdateRequest,
  ): StaffAccountChanges {
    return request
  },
}
