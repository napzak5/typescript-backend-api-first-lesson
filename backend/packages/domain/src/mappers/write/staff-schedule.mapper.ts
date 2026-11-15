import type {
  ApiStaffScheduleUpdateRequest,
  DbNewStaffSchedule,
} from '../../models/staff-schedule'

/**
 * API request → database rows. Property names are the column names and
 * nothing is converted: the database reads a time given as HH:mm.
 */
export const StaffScheduleWriteMapper = {
  fromUpdateRequest(
    request: ApiStaffScheduleUpdateRequest,
  ): DbNewStaffSchedule[] {
    return request.map((entry) => ({
      dayOfWeek: entry.dayOfWeek,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      breakStartTime: entry.breakStartTime,
      breakEndTime: entry.breakEndTime,
      isRecurring: entry.isRecurring,
      isAvailable: entry.isAvailable,
      notes: entry.notes,
    }))
  },
}
