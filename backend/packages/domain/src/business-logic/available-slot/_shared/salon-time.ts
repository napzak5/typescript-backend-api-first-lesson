import { tz } from '@date-fns/tz'
import {
  addDays,
  addHours,
  addMinutes,
  format,
  isValid,
  parseISO,
  subHours,
  subMinutes,
} from 'date-fns'
import { inTimeZone, withSeconds } from '../../../schemas/rules'
import type { TimeRange } from './time-ranges'

/**
 * The hours of a salon, its calendar and the schedules of its staff are
 * times of day without a date and without a time zone: they are what the
 * clocks of the salon show, on the day in question, in the time zone of
 * the salon.
 *
 * Where the clocks are put forward, a time they skip is taken as the
 * moment that much later (02:30 on a night on which 02:00 becomes 03:00 is
 * 03:30). Where they are put back, a time they show twice is the first of
 * the two moments.
 */

/** A moment as a plain date: one that is written in UTC. */
const plain = (moment: Date): Date => new Date(moment.getTime())

/**
 * The moment at which the clocks of a time zone show a time of day (HH:mm
 * or HH:mm:ss) of a date (`YYYY-MM-DD`). An invalid date when the runtime
 * does not know the zone.
 */
export const momentAt = (date: string, time: string, timeZone: string): Date =>
  plain(parseISO(`${date}T${withSeconds(time)}`, { in: tz(timeZone) }))

/**
 * A date (`YYYY-MM-DD`) in a time zone, from its first moment to the first
 * moment of the next date. Null when the runtime does not know the zone.
 */
export const dayIn = (date: string, timeZone: string): TimeRange | null => {
  const from = parseISO(`${date}T00:00:00`, { in: tz(timeZone) })

  return isValid(from)
    ? { from: plain(from), until: plain(addDays(from, 1)) }
    : null
}

/** The date (`YYYY-MM-DD`) that a moment is on in a time zone the runtime knows. */
export const dateIn = (moment: Date, timeZone: string): string =>
  format(inTimeZone(moment, timeZone), 'yyyy-MM-dd')

/** No clock is further ahead of UTC than this, in hours. */
const FURTHEST_AHEAD = 14

/** No clock is further behind UTC than this, in hours. */
const FURTHEST_BEHIND = 12

/**
 * The time within which a date (`YYYY-MM-DD`) lies in every time zone
 * there is, and so many minutes around it: what is read for a day before
 * the time zone of the salon is looked at. The minutes are the time that
 * is kept free around a booking, within which a booking of the day before
 * or after still matters.
 */
export const widestDayOf = (date: string, minutesAround: number): TimeRange => {
  const from = parseISO(`${date}T00:00:00Z`)

  return {
    from: subMinutes(subHours(from, FURTHEST_AHEAD), minutesAround),
    until: addMinutes(
      addHours(addDays(from, 1), FURTHEST_BEHIND),
      minutesAround,
    ),
  }
}
