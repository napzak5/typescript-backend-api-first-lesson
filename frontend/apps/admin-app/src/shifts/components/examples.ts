import type {
  ModelsDayOfWeekType,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'

/*
 * Schedules as the API answers them, for the stories: the times with their
 * seconds, the weekly rows from Monday, then the rows of dates. The week of
 * the stories is that of Monday 16 November 2026, and today is Friday the
 * 20th.
 */

/** The Monday of the week of the stories */
export const MONDAY = '2026-11-16'

/** Today, in the stories */
export const TODAY = '2026-11-20'

const weekly = (
  dayOfWeek: ModelsDayOfWeekType,
  startTime: string,
  endTime: string,
  rest: [string, string] | undefined,
): ModelsStaffSchedule => ({
  dayOfWeek,
  date: null,
  startTime,
  endTime,
  breakStartTime: rest?.[0] ?? null,
  breakEndTime: rest?.[1] ?? null,
  isRecurring: true,
  isAvailable: true,
  notes: null,
})

const LUNCH: [string, string] = ['13:00:00', '14:00:00']

/** Monday to Friday from 9 to 20 with a break at lunch, and Saturday from 10 to 18 */
export const aWeek = (): ModelsStaffSchedule[] => [
  weekly('monday', '09:00:00', '20:00:00', LUNCH),
  weekly('tuesday', '09:00:00', '20:00:00', LUNCH),
  weekly('wednesday', '09:00:00', '20:00:00', LUNCH),
  weekly('thursday', '09:00:00', '20:00:00', LUNCH),
  weekly('friday', '09:00:00', '20:00:00', LUNCH),
  weekly('saturday', '10:00:00', '18:00:00', undefined),
]

/** Sunday off, with a note */
export const aSundayOff = (): ModelsStaffSchedule => ({
  dayOfWeek: 'sunday',
  date: null,
  startTime: null,
  endTime: null,
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: true,
  isAvailable: false,
  notes: '定休日',
})

/** A day off for a training on the Wednesday of the week */
export const aTrainingDay = (): ModelsStaffSchedule => ({
  dayOfWeek: null,
  date: '2026-11-18',
  startTime: null,
  endTime: null,
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: false,
  isAvailable: false,
  notes: '研修',
})

/** Shorter hours on the Saturday of the week */
export const aShortSaturday = (): ModelsStaffSchedule => ({
  dayOfWeek: null,
  date: '2026-11-21',
  startTime: '12:00:00',
  endTime: '18:00:00',
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: false,
  isAvailable: true,
  notes: '午前は講習',
})

/** A day off of a week before */
export const aPastDayOff = (): ModelsStaffSchedule => ({
  dayOfWeek: null,
  date: '2026-11-02',
  startTime: null,
  endTime: null,
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: false,
  isAvailable: false,
  notes: null,
})

/** A whole schedule: the week, Sunday off, a day of a week before, and two dates of the week of the stories */
export const aSchedule = (): ModelsStaffSchedule[] => [
  ...aWeek(),
  aSundayOff(),
  aPastDayOff(),
  aTrainingDay(),
  aShortSaturday(),
]
