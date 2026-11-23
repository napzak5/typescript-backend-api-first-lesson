import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  monthUntil,
  type Period,
  periodIn,
  periodQueryOf,
  readPeriod,
} from '@beauty-salon-frontend/salon-screens'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

/** What was wrong with the form, and the days the address showed when it was sent */
type Refused = { asked: string; errors: FormErrors<LocalizedText> }

export type PeriodCount<Read> = {
  /** The days counted: those of the address, or the month up to today at the salon */
  period: Period
  /** The days counted, as the query of the address writes them */
  asked: string
  /** What was wrong with the days last sent, while the address shows those it was sent from */
  errors: FormErrors<LocalizedText> | undefined
  /** Counts over the days of the form: anew when they are the same, at another address when not */
  count: (values: FormData) => void
  read: UseQueryResult<Read>
  /** What the API counted since the screen was shown; nothing while it counts */
  shown: Read | undefined
}

/**
 * A count of the sales of a salon over the days in the query of the
 * address, or over the month up to today at the salon. It is read whenever
 * the screen is shown, and what an earlier screen read is not shown
 * meanwhile: a sale is entered at every checkout.
 */
export const usePeriodCount = <Read>(
  salon: ModelsSalonResponse,
  keyOf: (period: Period) => readonly string[],
  readOf: (period: Period) => Promise<Read>,
): PeriodCount<Read> => {
  const [query, setQuery] = useSearchParams()
  const [refused, setRefused] = useState<Refused>()
  const period = periodIn(query, monthUntil(dayAt(new Date(), salon.timezone)))
  const asked = periodQueryOf(period).toString()
  const errors = refused?.asked === asked ? refused.errors : undefined
  const read = useQuery({
    queryKey: keyOf(period),
    queryFn: () => readOf(period),
    staleTime: 0,
  })
  const shown = read.isFetchedAfterMount ? read.data : undefined

  const count = (values: FormData): void => {
    const filled = readPeriod(values)
    if (filled.type === 'invalid') {
      setRefused({ asked, errors: filled.errors })
      return
    }
    setRefused(undefined)
    if (periodQueryOf(filled.value).toString() === asked) {
      // The same days again: whoever sends them wants what there is now
      void read.refetch()
      return
    }
    setQuery(periodQueryOf(filled.value), { replace: true })
  }

  return { period, asked, errors, count, read, shown }
}
