import { isDay } from '@beauty-salon-frontend/salon-screens'
import type { Period } from '../customers/customer-statistics'
import { NOT_RECORDED } from './treatment-format'

/*
 * The statistics of the treatment records of a salon: the days they are
 * counted over, kept in the query of the address, and how the counts are
 * said.
 */

/** The month up to today: from its first day, both ends counted. */
export const monthUntil = (today: string): Period => ({
  from: `${today.slice(0, 8)}01`,
  to: today,
})

/**
 * The period in the query of an address: the month up to today, unless
 * the address names days the API counts over.
 */
export const statisticsPeriodIn = (
  query: URLSearchParams,
  today: string,
): Period => {
  const from = query.get('from') ?? ''
  const to = query.get('to') ?? ''

  return isDay(from) && isDay(to) && from <= to
    ? { from, to }
    : monthUntil(today)
}

/** How many records were counted: 「12 件」. */
export const countNameOf = (count: number): string => `${count} 件`

const MINUTES = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })

/** How long the treatments took on average: 「72.5 分」, or that no time was recorded. */
export const averageNameOf = (minutes: number | null): string =>
  minutes === null ? NOT_RECORDED : `${MINUTES.format(minutes)} 分`
