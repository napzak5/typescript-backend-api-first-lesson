import { DayOfWeekTypeSchema } from '@beauty-salon-backend/generated'
import { asOneString, type LocalizedText } from '@beauty-salon-shared/i18n'
import {
  ruleMessages,
  staffScheduleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import type {
  ApiStaffSchedule,
  ApiStaffScheduleSearchRequest,
  ApiStaffScheduleUpdateRequest,
} from '../models/staff-schedule'
import { calendarDate, nonBlankText, timeOfDay, withSeconds } from './rules'

/**
 * Validation of the requests for the schedule of a staff member. The
 * shapes are checked against the generated API types; the rules of an
 * entry are those the CHECK constraints of `staff_schedules` keep, and the
 * rule between entries is that of its unique indexes.
 */

/** The seven weekly entries and one entry for every day of a year. */
const MAX_STAFF_SCHEDULES = 7 + 366

/**
 * A time in the form in which two of them compare. Null for no time and
 * for a text that is not a time; the format rule reports that.
 */
const comparable = (time: string | null): string | null =>
  time !== null && timeOfDay.safeParse(time).success ? withSeconds(time) : null

const staffScheduleSchema = z
  .strictObject({
    dayOfWeek: DayOfWeekTypeSchema.nullable(),
    date: calendarDate.nullable(),
    startTime: timeOfDay.nullable(),
    endTime: timeOfDay.nullable(),
    breakStartTime: timeOfDay.nullable(),
    breakEndTime: timeOfDay.nullable(),
    isRecurring: z.boolean(),
    isAvailable: z.boolean(),
    notes: nonBlankText.nullable(),
  })
  .check((context) => {
    const {
      dayOfWeek,
      date,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      isRecurring,
      isAvailable,
    } = context.value
    // An entry that breaks a rule is still compared with the others: a
    // request learns of all it has to correct at once.
    const report = (
      property: string,
      input: unknown,
      written: LocalizedText,
    ) => {
      context.issues.push({
        code: 'custom',
        path: [property],
        message: asOneString(written),
        input,
        continue: true,
      })
    }

    // A weekly entry names a day of the week, the other kind a date.
    if (isRecurring) {
      if (dayOfWeek === null) {
        report(
          'dayOfWeek',
          dayOfWeek,
          staffScheduleMessages.requiredForWeeklyEntry,
        )
      }
      if (date !== null) {
        report('date', date, staffScheduleMessages.nullForWeeklyEntry)
      }
    } else {
      if (date === null) {
        report('date', date, staffScheduleMessages.requiredForSingleDay)
      }
      if (dayOfWeek !== null) {
        report('dayOfWeek', dayOfWeek, staffScheduleMessages.nullForSingleDay)
      }
    }

    // A day off has no hours; nothing is left to compare.
    if (!isAvailable) {
      const times = { startTime, endTime, breakStartTime, breakEndTime }
      for (const [property, time] of Object.entries(times)) {
        if (time !== null) {
          report(property, time, staffScheduleMessages.nullForDayOff)
        }
      }
      return
    }

    if (startTime === null) {
      report(
        'startTime',
        startTime,
        staffScheduleMessages.requiredForWorkingDay,
      )
    }
    if (endTime === null) {
      report('endTime', endTime, staffScheduleMessages.requiredForWorkingDay)
    }
    if (breakStartTime !== null && breakEndTime === null) {
      report(
        'breakEndTime',
        breakEndTime,
        staffScheduleMessages.requiredWhenGiven('breakStartTime'),
      )
    }
    if (breakStartTime === null && breakEndTime !== null) {
      report(
        'breakStartTime',
        breakStartTime,
        staffScheduleMessages.requiredWhenGiven('breakEndTime'),
      )
    }

    const start = comparable(startTime)
    const end = comparable(endTime)
    const breakStart = comparable(breakStartTime)
    const breakEnd = comparable(breakEndTime)

    if (start !== null && end !== null && end <= start) {
      report('endTime', endTime, ruleMessages.laterThan('startTime'))
    }
    // A break lies inside the working hours: one at their start or at
    // their end would be a shorter working day.
    if (start !== null && breakStart !== null && breakStart <= start) {
      report(
        'breakStartTime',
        breakStartTime,
        ruleMessages.laterThan('startTime'),
      )
    }
    if (breakStart !== null && breakEnd !== null && breakEnd <= breakStart) {
      report(
        'breakEndTime',
        breakEndTime,
        ruleMessages.laterThan('breakStartTime'),
      )
    }
    if (breakEnd !== null && end !== null && end <= breakEnd) {
      report(
        'breakEndTime',
        breakEndTime,
        staffScheduleMessages.earlierThan('endTime'),
      )
    }
  }) satisfies z.ZodType<ApiStaffSchedule>

/**
 * A staff member has one weekly entry per day of the week and one entry per
 * date. An entry that repeats the day of an earlier one is reported under
 * its own index; one without a day is reported by its own rule.
 */
const noRepeatedDays = (
  context: z.core.ParsePayload<ApiStaffSchedule[]>,
): void => {
  const weekly = new Set<string>()
  const singleDays = new Set<string>()

  context.value.forEach((entry, index) => {
    if (entry.isRecurring && entry.dayOfWeek !== null) {
      if (weekly.has(entry.dayOfWeek)) {
        context.issues.push({
          code: 'custom',
          path: [index, 'dayOfWeek'],
          message: asOneString(staffScheduleMessages.noRepeatedDayOfWeek),
          input: entry.dayOfWeek,
        })
      }
      weekly.add(entry.dayOfWeek)
    }
    if (!entry.isRecurring && entry.date !== null) {
      if (singleDays.has(entry.date)) {
        context.issues.push({
          code: 'custom',
          path: [index, 'date'],
          message: asOneString(staffScheduleMessages.noRepeatedDate),
          input: entry.date,
        })
      }
      singleDays.add(entry.date)
    }
  })
}

/** The whole schedule of a staff member; an empty list is one. */
export const staffScheduleUpdateRequestSchema = z
  .array(staffScheduleSchema)
  .max(MAX_STAFF_SCHEDULES)
  .check(noRepeatedDays) satisfies z.ZodType<ApiStaffScheduleUpdateRequest>

export const staffScheduleSearchRequestSchema = z.strictObject({
  date: calendarDate.exactOptional(),
}) satisfies z.ZodType<ApiStaffScheduleSearchRequest>
