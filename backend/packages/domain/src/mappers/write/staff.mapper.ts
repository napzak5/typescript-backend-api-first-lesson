import type {
  ApiStaffCreateRequest,
  ApiStaffUpdateRequest,
  DbNewStaff,
  DbStaffChanges,
} from '../../models/staff'

/**
 * API request → database row. Property names are the column names, so the
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
}
