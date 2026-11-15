import type { staffSchedules } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import type { DeepRequired, Omit } from '@beauty-salon-backend/utility'

/**
 * The schedule of a staff member: the rows of `staff_schedules` that say
 * when the staff member works. A weekly row applies to its day of every
 * week, a row for a single day to its date alone, and on that date in
 * place of the weekly one.
 */

// API types, generated from TypeSpec
export type ApiStaffSchedule = components['schemas']['Models.StaffSchedule']
export type ApiStaffScheduleUpdateRequest =
  components['schemas']['Models.StaffScheduleUpdateRequest']
export type ApiStaffScheduleSearchRequest = NonNullable<
  operations['StaffSchedules_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbStaffSchedule = DeepRequired<typeof staffSchedules.$inferSelect>

/** A row of `staff_schedules` before it is attached to a staff member. */
export type DbNewStaffSchedule = DeepRequired<
  Omit<
    typeof staffSchedules.$inferInsert,
    'id' | 'staffId' | 'createdAt' | 'updatedAt'
  >
>
