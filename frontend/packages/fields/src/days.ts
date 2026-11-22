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
