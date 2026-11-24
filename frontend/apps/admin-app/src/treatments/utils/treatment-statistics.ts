import { isDay } from '@beauty-salon-frontend/fields'
import { monthUntil, type Period } from '@beauty-salon-frontend/salon-screens'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'

/*
 * The statistics of the treatment records of a salon: the days they are
 * counted over, kept in the query of the address, and how the counts are
 * said.
 */

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

/** How long the treatments took on average: 「72.5 分」, or `null` when no time was recorded. */
export const averageNameOf = (minutes: number | null): LocalizedText | null =>
  minutes === null ? null : formats.minutesOf(minutes, { most: 1 })
