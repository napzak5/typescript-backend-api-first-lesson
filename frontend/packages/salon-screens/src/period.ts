import { isDay } from '@beauty-salon-frontend/fields'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'
import { dayAfter, dayNameOf } from './salon-time'

/** The days something of a salon is counted over, on its clock; both ends counted. */
export type Period = { from: string; to: string }

/** The most days the API counts over */
const MOST_DAYS = 366

/** How many days a period has, both ends counted. */
const daysOf = ({ from, to }: Period): number =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    (24 * 60 * 60 * 1000) +
  1

/** The month up to today: from its first day, both ends counted. */
export const monthUntil = (today: string): Period => ({
  from: `${today.slice(0, 8)}01`,
  to: today,
})

/** The year up to today: the 366 days that end with it. */
export const lastYearUntil = (today: string): Period => ({
  from: dayAfter(today, 1 - MOST_DAYS),
  to: today,
})

/**
 * The period in the query of an address, unless it names none the API
 * counts over: then the one a screen starts with (the year or the month up
 * to today).
 */
export const periodIn = (query: URLSearchParams, initial: Period): Period => {
  const from = query.get('from') ?? ''
  const to = query.get('to') ?? ''

  return isDay(from) &&
    isDay(to) &&
    from <= to &&
    daysOf({ from, to }) <= MOST_DAYS
    ? { from, to }
    : initial
}

const DAY_ERROR = '日付を入力してください。'

const RANGE_ERROR = '終わりの日は、始まりの日と同じか、その後にしてください。'

/**
 * What is wrong with the first and the last day of a period, under the
 * controls `from` and `to`: a day that is none, and an end before the
 * start. The days of a search may be left empty (`optional`), those of a
 * count may not (`required`).
 */
export const daysErrorsOf = (
  from: string,
  to: string,
  ends: 'required' | 'optional',
): Record<string, string> => {
  const wrong = (day: string): boolean =>
    !isDay(day) && (ends === 'required' || day !== '')

  return isDay(from) && isDay(to) && to < from
    ? { to: RANGE_ERROR }
    : {
        ...(wrong(from) ? { from: DAY_ERROR } : {}),
        ...(wrong(to) ? { to: DAY_ERROR } : {}),
      }
}

/** The days that were filled in: both of them, the end not before the start. */
export const readDays = (values: FormData): FormRead<Period> => {
  const from = textOf(values, 'from').trim()
  const to = textOf(values, 'to').trim()
  const errors = daysErrorsOf(from, to, 'required')

  return Object.keys(errors).length > 0
    ? { type: 'invalid', errors }
    : { type: 'valid', value: { from, to } }
}

/** The period that was filled in: the days, no more of them than the API counts over. */
export const readPeriod = (values: FormData): FormRead<Period> => {
  const days = readDays(values)

  return days.type === 'valid' && daysOf(days.value) > MOST_DAYS
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
