import { tz } from '@date-fns/tz'
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfISOWeek,
} from 'date-fns'

/**
 * The dates of a report are dates of the calendar (`YYYY-MM-DD`), the days
 * of the sales in the time zone of their salon. They are counted in UTC,
 * where every day has 24 hours, whatever the time zone of the server.
 */

const UTC = tz('UTC')

const dayOf = (date: string): Date => parseISO(date, { in: UTC })

const writtenDay = (day: Date): string => format(day, 'yyyy-MM-dd', { in: UTC })

/** How many days a period has, both of its ends included. */
export const daysIn = (startDate: string, endDate: string): number =>
  differenceInCalendarDays(dayOf(endDate), dayOf(startDate), { in: UTC }) + 1

/** Every date of a period in their order, both of its ends included. */
export const datesOf = (startDate: string, endDate: string): string[] =>
  Array.from({ length: daysIn(startDate, endDate) }, (_, index) =>
    writtenDay(addDays(dayOf(startDate), index, { in: UTC })),
  )

/** The Monday of the week (beginning on a Monday) that a date is in. */
export const mondayOf = (date: string): string =>
  writtenDay(startOfISOWeek(dayOf(date), { in: UTC }))

/** The month (`YYYY-MM`) that a date is in. */
export const monthOf = (date: string): string => date.slice(0, 7)
