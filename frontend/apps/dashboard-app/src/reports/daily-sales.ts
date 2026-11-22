import {
  dayAfter,
  EARLIEST_DAY,
  isDay,
} from '@beauty-salon-frontend/salon-screens'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'

/*
 * The day whose sales are shown: kept in the address, today at the salon
 * when it names none, and the days before and after it.
 */

/** The day in the query of an address, unless it names none the API counts: then today. */
export const dayIn = (query: URLSearchParams, today: string): string => {
  const day = query.get('date') ?? ''

  return isDay(day) ? day : today
}

/** The query that keeps a day in an address. */
export const dayQueryOf = (day: string): URLSearchParams =>
  new URLSearchParams({ date: day })

/** The day that was filled in. */
export const readDay = (values: FormData): FormRead<string> => {
  const day = textOf(values, 'date').trim()

  return isDay(day)
    ? { type: 'valid', value: day }
    : { type: 'invalid', errors: { date: '日付を入力してください。' } }
}

/** The days a day leads to */
export type Neighbours = {
  /** The day before; none before the first day the API takes */
  before: string | undefined
  /** The day after; none after today, whose sales are not entered yet */
  after: string | undefined
}

/** The days before and after a day. */
export const neighboursOf = (day: string, today: string): Neighbours => ({
  before: day > EARLIEST_DAY ? dayAfter(day, -1) : undefined,
  after: day < today ? dayAfter(day, 1) : undefined,
})
