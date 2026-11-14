import { salons, staff, users } from '@beauty-salon-backend/database'
import { and, eq, isNull } from 'drizzle-orm'

/**
 * How a user row becomes a `UserAccount`: the user, and the salon of the
 * staff member the user is linked to. The joins are left joins, and they
 * find a salon only while the staff member is active and neither the staff
 * member nor the salon is deleted.
 */

export const accountColumns = { user: users, staffSalonId: salons.id }

export const userNotDeleted = isNull(users.deletedAt)

export const staffOfUser = and(
  eq(staff.id, users.staffId),
  eq(staff.isActive, true),
  isNull(staff.deletedAt),
)

export const salonOfStaff = and(
  eq(salons.id, staff.salonId),
  isNull(salons.deletedAt),
)
