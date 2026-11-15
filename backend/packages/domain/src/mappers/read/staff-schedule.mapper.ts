import type {
  ApiStaffSchedule,
  DbStaffSchedule,
} from '../../models/staff-schedule'

/**
 * A row of `staff_schedules` → an entry of the schedule. Property names are
 * the column names, and no column changes its representation, so nothing
 * can fail. The ID of a row is left out: the rows are written anew whenever
 * the schedule is replaced, so it names nothing a client could keep.
 */
export const StaffScheduleReadMapper = {
  toApiStaffSchedule(schedule: DbStaffSchedule): ApiStaffSchedule {
    return {
      dayOfWeek: schedule.dayOfWeek,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      breakStartTime: schedule.breakStartTime,
      breakEndTime: schedule.breakEndTime,
      isRecurring: schedule.isRecurring,
      isAvailable: schedule.isAvailable,
      notes: schedule.notes,
    }
  },
}
