import type { DbStaffSchedule } from '../../../models/staff-schedule'
import { dayOfWeekOf } from '../../../schemas/rules'

/**
 * The row of a staff member's schedule that applies on a date
 * (`YYYY-MM-DD`): the row for that single day, or else the weekly row of
 * its day of the week. Null when there is neither, which means that the
 * staff member does not work on that day. The row that applies may itself
 * be a day off.
 */
export const scheduleOn = (
  schedules: DbStaffSchedule[],
  date: string,
): DbStaffSchedule | null => {
  const dayOfWeek = dayOfWeekOf(date)

  return (
    schedules.find((schedule) => schedule.date === date) ??
    schedules.find(
      (schedule) => schedule.isRecurring && schedule.dayOfWeek === dayOfWeek,
    ) ??
    null
  )
}
