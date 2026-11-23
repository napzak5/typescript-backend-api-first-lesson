import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'

/*
 * Days and times at a salon. A booking is on a day at the salon, and its
 * times are said as the clock of the salon shows them, whatever the time
 * zone of the browser.
 */

/** The day a moment is on at a salon: `2026-11-20`. */
export const dayAt = (moment: Date, timezone: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment)

/**
 * The time of day a moment is at a salon, as a control of a time holds it,
 * in every language: `09:30`.
 */
export const timeAt = (moment: string, timezone: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(moment))

/** The day so many days after another (before it, for a negative number). */
export const dayAfter = (day: string, days: number): string => {
  const moment = new Date(`${day}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + days)

  return moment.toISOString().slice(0, 10)
}

/** A day as a heading names it: 「2026年11月20日（金）」. */
export const dayNameOf = (day: string): LocalizedText =>
  formats.dayWithWeekdayOf(day)

/** The time of day of a moment at a salon: 「10:30」. */
export const timeOfDayAt = (moment: string, timezone: string): LocalizedText =>
  formats.timeOfDayAt(moment, timezone)

/** A moment at a salon, day and time: 「2026年11月20日（金） 10:30」. */
export const momentNameAt = (moment: string, timezone: string): LocalizedText =>
  formats.momentWithWeekdayAt(moment, timezone)

const LOCAL_MOMENT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** How far the clock of a time zone is ahead of UTC at a moment, in milliseconds. */
const offsetAt = (moment: number, timezone: string): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(moment))
      .map(({ type, value }) => [type, Number(value)]),
  )
  const shown = Date.UTC(
    parts['year'] ?? 0,
    (parts['month'] ?? 1) - 1,
    parts['day'] ?? 1,
    parts['hour'] ?? 0,
    parts['minute'] ?? 0,
    parts['second'] ?? 0,
  )

  return shown - (moment - (moment % 1000))
}

/**
 * The moment, in UTC, that the clock of a salon shows as a date and a time
 * (`2026-11-20T10:30`, what a field of the type `datetime-local` holds).
 * `undefined` for what is no such value, and for a time the clock skips
 * when it is put forward.
 */
export const momentOf = (
  local: string,
  timezone: string,
): string | undefined => {
  const parts = LOCAL_MOMENT.exec(local)
  if (parts === null) {
    return undefined
  }
  const [, year, month, day, hour, minute] = parts.map(Number)
  const asUtc = Date.UTC(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
  )
  // The offset at the moment is that of the moment itself, which is not
  // known yet: the offset at the same reading in UTC comes close, and the
  // offset at that guess is the one
  const guess = asUtc - offsetAt(asUtc, timezone)
  const moment = asUtc - offsetAt(guess, timezone)
  const shown = new Date(moment + offsetAt(moment, timezone))
    .toISOString()
    .slice(0, 16)

  return shown === local ? new Date(moment).toISOString() : undefined
}

/** The times of a day, a quarter of an hour apart: 「00:00」, 「00:15」… */
const QUARTERS = Array.from(
  { length: 24 * 4 },
  (_, quarter) =>
    `${String(Math.floor(quarter / 4)).padStart(2, '0')}:${String((quarter % 4) * 15).padStart(2, '0')}`,
)

/**
 * The moment, in UTC, a day begins at a salon: midnight on its clock, or
 * the first quarter of an hour the clock shows on a day it skips midnight
 * (where clocks are put forward at midnight). `undefined` for what is no
 * day.
 */
export const startOfDayAt = (
  day: string,
  timezone: string,
): string | undefined => {
  const first = QUARTERS.find(
    (time) => momentOf(`${day}T${time}`, timezone) !== undefined,
  )

  return first === undefined ? undefined : momentOf(`${day}T${first}`, timezone)
}
