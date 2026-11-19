/*
 * Days and times at a salon. A booking is on a day at the salon, and its
 * times are said as the clock of the salon shows them, whatever the time
 * zone of the browser.
 */

/** The first and the last day the API takes in a request */
export const EARLIEST_DAY = '1900-01-01'
export const LATEST_DAY = '2999-12-31'

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Whether a text is a day of the calendar (`2026-11-20`) that the API
 * takes: one that exists, from 1900 to 2999.
 */
export const isDay = (text: string): boolean =>
  DAY.test(text) &&
  !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) &&
  new Date(`${text}T00:00:00Z`).toISOString().startsWith(text) &&
  text >= EARLIEST_DAY &&
  text <= LATEST_DAY

/** The day a moment is on at a salon: `2026-11-20`. */
export const dayAt = (moment: Date, timezone: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment)

/** The day so many days after another (before it, for a negative number). */
export const dayAfter = (day: string, days: number): string => {
  const moment = new Date(`${day}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + days)

  return moment.toISOString().slice(0, 10)
}

/** A day as a heading names it: 「2026年11月20日（金）」. */
export const dayNameOf = (day: string): string => {
  const moment = new Date(`${day}T00:00:00Z`)
  const date = new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(moment)
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(moment)

  return `${date}（${weekday}）`
}

/** The time of day of a moment at a salon: 「10:30」. */
export const timeOfDayAt = (moment: string, timezone: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(new Date(moment))

/** A moment at a salon, day and time: 「2026年11月20日（金） 10:30」. */
export const momentNameAt = (moment: string, timezone: string): string =>
  `${dayNameOf(dayAt(new Date(moment), timezone))} ${timeOfDayAt(moment, timezone)}`

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
