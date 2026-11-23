import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  PeriodSwitch,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { dailySalesKeyOf, readDailySales } from '../api/sales-report-api'
import { DailySales } from '../components/daily-sales/daily-sales'
import { DayChoice } from '../components/day-choice/day-choice'
import { dayIn, dayQueryOf, neighboursOf, readDay } from '../utils/daily-sales'
import { ReportRefusal } from './report-refusal'

const { daily: words, names, titles } = dashboardReportMessages

/** What was wrong with the form, and the day the address showed when it was sent */
type Refused = { asked: string; errors: FormErrors<LocalizedText> }

/**
 * The sales of the salon on one day: today at the salon, or the day in
 * the query of the address, with the ways to the days before and after
 * it. They are read whenever the screen is shown, and what an earlier
 * screen read is not shown meanwhile.
 */
const DayPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const [query, setQuery] = useSearchParams()
  const { pathname } = useLocation()
  // What was wrong with what was sent, while the address shows the day it was sent from
  const [refused, setRefused] = useState<Refused>()
  const today = dayAt(new Date(), salon.timezone)
  const day = dayIn(query, today)
  const errors = refused?.asked === day ? refused.errors : undefined
  const { before, after } = neighboursOf(day, today)
  const hrefOf = (other: string | undefined): string | undefined =>
    other === undefined
      ? undefined
      : `${pathname}?${dayQueryOf(other).toString()}`
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
    if (filled.value === day) {
      // The same day again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(dayQueryOf(filled.value), { replace: true })
  }

  return (
    <>
      <PageHeader title={say(titles.daily)} description={salon.name} />
      {match(shown)
        .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
          <ReportRefusal refusal={type} what={names.seen.sales} />
        ))
        .with(
          P.union(undefined, {
            type: P.union('found', P.union(...UNREAD_TYPES)),
          }),
          (counted) => (
            <>
              <DayChoice day={day} errors={errors} onSubmit={show} />
              <PeriodSwitch
                label={say(words.otherDays)}
                unit='day'
                beforeHref={hrefOf(before)}
                currentHref={pathname}
                afterHref={hrefOf(after)}
              />
              {match(counted)
                .with(undefined, () => (
                  <LoadingIndicator
                    label={say(dashboardReportMessages.counting)}
                  />
                ))
                .with({ type: 'found' }, ({ sales }) => (
                  <DailySales sales={sales} currency={salon.currency} />
                ))
                .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
                  <UnreadNotice
                    message={say(unreadMessageOf(names.read.sales, reason))}
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
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.daily)}>
      {(salon) => <DayPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
