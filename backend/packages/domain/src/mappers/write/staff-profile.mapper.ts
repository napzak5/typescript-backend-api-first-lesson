import type { ApiStaffProfileUpdateRequest } from '../../models/staff-profile'
import type {
  StaffProfileChanges,
  StaffProfileListCriteria,
} from '../../repositories/staff-profile.repository'
import type { StaffProfileSearchRequest } from '../../schemas/staff-profile.schema'
import { toPaging } from './page'

/**
 * API request → what the repository takes. The properties a staff member
 * changes of their own profile are named and typed as the columns are, so
 * the changes are the request as it is: the mapper is where the compiler
 * checks that the two agree.
 */
export const StaffProfileWriteMapper = {
  /** Only the properties present in the request become changes. */
  fromUpdateRequest(
    request: ApiStaffProfileUpdateRequest,
  ): StaffProfileChanges {
    return request
  },

  /** A filter the request does not name is none. */
  fromSearchRequest(
    request: StaffProfileSearchRequest,
  ): StaffProfileListCriteria {
    const { salonId, specialty, city } = request

    return {
      ...toPaging(request),
      salonId: salonId ?? null,
      specialty: specialty ?? null,
      city: city ?? null,
    }
  },
}
