import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { DailySales } from './components/daily-sales/daily-sales'
import { DayChoice } from './components/day-choice/day-choice'
import { dayIn, dayQueryOf, neighboursOf, readDay } from './daily-sales'
import styles from './daily-sales-screen.module.css'
import { ReportRefusal } from './report-refusal'
import { dailySalesKeyOf, readDailySales } from './sales-report-api'

const TITLE = '1 日の売上'

const UNREAD = P.union('tooManyRequests', 'failed')

/** What was wrong with the form, and the day the address showed when it was sent */
type Refused = { asked: string; errors: FormErrors }

/**
 * The sales of the salon on one day: today at the salon, or the day in
 * the query of the address, with the ways to the days before and after
 * it. They are read whenever the screen is shown, and what an earlier
 * screen read is not shown meanwhile.
 */
const DayPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const [query, setQuery] = useSearchParams()
  const { pathname } = useLocation()
  // What was wrong with what was sent, while the address shows the day it was sent from
  const [refused, setRefused] = useState<Refused>()
  const today = dayAt(new Date(), salon.timezone)
  const day = dayIn(query, today)
  const errors = refused?.asked === day ? refused.errors : undefined
  const { before, after } = neighboursOf(day, today)
  const read = useQuery({
    queryKey: dailySalesKeyOf(salon.id, day),
    queryFn: () => readDailySales(salon.id, day),
    staleTime: 0,
  })
  const shown = read.isFetchedAfterMount ? read.data : undefined

  const show = (values: FormData): void => {
    const filled = readDay(values)
    if (filled.type === 'invalid') {
      setRefused({ asked: day, errors: filled.errors })
      return
    }
    setRefused(undefined)
    if (filled.request === day) {
      // The same day again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(dayQueryOf(filled.request), { replace: true })
  }

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match(shown)
        .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
          <ReportRefusal refusal={type} what='売上' />
        ))
        .with(
          P.union(undefined, { type: P.union('found', UNREAD) }),
          (counted) => (
            <>
              <DayChoice day={day} errors={errors} onSubmit={show} />
              <nav className={styles['days']} aria-label='ほかの日'>
                {before !== undefined && (
                  <ButtonLink
                    href={`${pathname}?${dayQueryOf(before).toString()}`}
                  >
                    前の日
                  </ButtonLink>
                )}
                {after !== undefined && (
                  <ButtonLink
                    href={`${pathname}?${dayQueryOf(after).toString()}`}
                  >
                    次の日
                  </ButtonLink>
                )}
              </nav>
              {match(counted)
                .with(undefined, () => (
                  <LoadingIndicator label='売上を集計しています' />
                ))
                .with({ type: 'found' }, ({ sales }) => (
                  <DailySales sales={sales} currency={salon.currency} />
                ))
                .with({ type: UNREAD }, (reason) => (
                  <UnreadNotice
                    message={unreadMessageOf('売上', reason)}
                    onRetry={() => void read.refetch()}
                    pending={read.isFetching}
                  />
                ))
                .exhaustive()}
            </>
          ),
        )
        .exhaustive()}
    </>
  )
}

/** The sales of one day of the salon of the address. */
export const DailySalesScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <DayPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
