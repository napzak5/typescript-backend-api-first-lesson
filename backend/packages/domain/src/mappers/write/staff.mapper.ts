import type { SalonId } from '../../models/salon'
import type {
  ApiStaffCreateRequest,
  ApiStaffUpdateRequest,
  DbNewStaff,
  DbStaffChanges,
} from '../../models/staff'
import type { StaffListCriteria } from '../../repositories/staff.repository'
import type { StaffSearchRequest } from '../../schemas/staff.schema'
import { toPaging } from './page'

/**
 * API request → what the repository takes: a row of the staff ledger, the
 * changes of one, the criteria of a list. Property names are the column names, so the
 * only conversion is the representation of the `numeric` column
 * (`commissionRate`), which the driver reads and writes as a string to keep
 * its precision.
 */

const toNumeric = (value: number): string => String(value)

export const StaffWriteMapper = {
  fromCreateRequest(request: ApiStaffCreateRequest): DbNewStaff {
    const { commissionRate, ...columns } = request

    return {
      ...columns,
      commissionRate:
        commissionRate === null ? null : toNumeric(commissionRate),
    }
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(request: ApiStaffUpdateRequest): DbStaffChanges {
    const { commissionRate, ...columns } = request

    return {
      ...columns,
      ...(commissionRate === undefined
        ? {}
        : {
            commissionRate:
              commissionRate === null ? null : toNumeric(commissionRate),
          }),
    }
  },

  /** The staff members of the salon of the path. */
  fromSearchRequest(
    request: StaffSearchRequest,
    salonId: SalonId,
  ): StaffListCriteria {
    return { salonId, ...toPaging(request) }
  },
}
