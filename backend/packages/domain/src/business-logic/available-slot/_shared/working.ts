import type { DbStaffSchedule } from '../../../models/staff-schedule'
import { momentAt } from './salon-time'
import { joined, type TimeRange, without } from './time-ranges'

/**
 * When a staff member works on a date (`YYYY-MM-DD`), told from the row of
 * their schedule that applies on it: from the beginning of the shift to
 * its end, without the break. Nobody works on a day without a row, or on
 * one whose row is a day off. The times are those of the salon's clocks.
 */
export const workingRangesOf = (
  schedule: DbStaffSchedule | null,
  date: string,
  timeZone: string,
): TimeRange[] => {
  if (
    schedule === null ||
    !schedule.isAvailable ||
    schedule.startTime === null ||
    schedule.endTime === null
  ) {
    return []
  }

  const at = (time: string): Date => momentAt(date, time, timeZone)
  const shift = joined([
    { from: at(schedule.startTime), until: at(schedule.endTime) },
  ])

  return schedule.breakStartTime === null || schedule.breakEndTime === null
    ? shift
    : without(shift, [
        { from: at(schedule.breakStartTime), until: at(schedule.breakEndTime) },
      ])
}
