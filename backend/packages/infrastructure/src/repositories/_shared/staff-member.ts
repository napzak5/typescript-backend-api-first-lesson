import { staff } from '@beauty-salon-backend/database'
import type { SalonId, StaffId } from '@beauty-salon-backend/domain'
import { and, eq, isNull } from 'drizzle-orm'

/** The staff member, if the salon has them and they are not deleted. */
export const staffMemberOf = (salonId: SalonId, staffId: StaffId) =>
  and(
    eq(staff.id, staffId),
    eq(staff.salonId, salonId),
    isNull(staff.deletedAt),
  )
