import { type Read, textOf } from '../bookings/booking-actions'
import { dayAfter, dayNameOf, isDay } from '../salon-time'

/** The days of the visits the use of a salon is counted over, at the salon; both ends counted. */
export type Period = { from: string; to: string }

/** The most days the API counts over */
const MOST_DAYS = 366

/** How many days a period has, both ends counted. */
const daysOf = ({ from, to }: Period): number =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    (24 * 60 * 60 * 1000) +
  1

/** The year up to today: the 366 days that end with it. */
export const lastYearUntil = (today: string): Period => ({
  from: dayAfter(today, 1 - MOST_DAYS),
  to: today,
})

/**
 * The period in the query of an address: the year up to today, unless the
 * address names one the API counts over.
 */
export const periodIn = (query: URLSearchParams, today: string): Period => {
  const from = query.get('from') ?? ''
  const to = query.get('to') ?? ''

  return isDay(from) &&
    isDay(to) &&
    from <= to &&
    daysOf({ from, to }) <= MOST_DAYS
    ? { from, to }
    : lastYearUntil(today)
}

const DAY_ERROR = '日付を入力してください。'

/** The days that were filled in: both of them, the end not before the start. */
export const readDays = (values: FormData): Read<Period> => {
  const from = textOf(values, 'from').trim()
  const to = textOf(values, 'to').trim()
  const errors = {
    ...(isDay(from) ? {} : { from: DAY_ERROR }),
    ...(isDay(to) ? {} : { to: DAY_ERROR }),
  }
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  if (to < from) {
    return {
      type: 'invalid',
      errors: {
        to: '終わりの日は、始まりの日と同じか、その後にしてください。',
      },
    }
  }

  return { type: 'valid', request: { from, to } }
}

/** The period that was filled in: the days, no more of them than the API counts over. */
export const readPeriod = (values: FormData): Read<Period> => {
  const days = readDays(values)

  return days.type === 'valid' && daysOf(days.request) > MOST_DAYS
    ? {
        type: 'invalid',
        errors: { to: `期間は ${MOST_DAYS} 日までにしてください。` },
      }
    : days
}

/** The query that keeps a period in an address. */
export const periodQueryOf = ({ from, to }: Period): URLSearchParams =>
  new URLSearchParams({ from, to })

/** A period in words: 「2025年11月21日（金）〜2026年11月20日（金）」. */
export const periodNameOf = ({ from, to }: Period): string =>
  from === to ? dayNameOf(from) : `${dayNameOf(from)}〜${dayNameOf(to)}`
