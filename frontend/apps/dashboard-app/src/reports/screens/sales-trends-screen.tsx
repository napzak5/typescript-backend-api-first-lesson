import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  periodIn,
  periodNameOf,
  readPeriod,
  StatisticsPeriod,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  RadioGroup,
  UnreadNotice,
  useSaidChoices,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { readSalesTrends, salesTrendsKeyOf } from '../api/sales-report-api'
import { SalesTrend } from '../components/sales-trend/sales-trend'
import {
  partsOf,
  readTrendUnit,
  TREND_UNITS,
  trendsQueryOf,
  trendUnitIn,
  trendUnitOf,
  twelveMonthsUntil,
} from '../utils/sales-trends'
import { ReportRefusal } from './report-refusal'

const { names, titles, trends: words } = dashboardReportMessages

/** What was wrong with the form, and the days and the parts the address showed when it was sent */
type Refused = { asked: string; errors: FormErrors<LocalizedText> }

/**
 * The sales of the salon over a period, part by part: the twelve months up
 * to today at the salon, cut into months, or the days and the parts in the
 * query of the address. They are read whenever the screen is shown, and
 * what an earlier screen read is not shown meanwhile.
 */
const TrendsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const options = useSaidChoices()
  const [query, setQuery] = useSearchParams()
  // What was wrong with what was sent, while the address shows what it was sent from
  const [refused, setRefused] = useState<Refused>()
  const period = periodIn(
    query,
    twelveMonthsUntil(dayAt(new Date(), salon.timezone)),
  )
  const unit = trendUnitIn(query)
  const asked = trendsQueryOf(period, unit).toString()
  const errors = refused?.asked === asked ? refused.errors : undefined
  // The parts chosen, until the form is sent; those of the address when it changes
  const [chosen, setChosen] = useState({ asked, unit })
  if (chosen.asked !== asked) {
    setChosen({ asked, unit })
  }
  const read = useQuery({
    queryKey: salesTrendsKeyOf(salon.id, period, unit),
    queryFn: () => readSalesTrends(salon.id, period, unit),
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
    const next = trendsQueryOf(filled.value, readTrendUnit(values))
    if (next.toString() === asked) {
      // The same parts again: whoever sends them wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  return (
    <>
      <PageHeader title={say(titles.trends)} description={salon.name} />
      {match(shown)
        .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
          <ReportRefusal refusal={type} what={names.seen.trends} />
        ))
        .with(
          P.union(undefined, {
            type: P.union('found', P.union(...UNREAD_TYPES)),
          }),
          (counted) => (
            <>
              <StatisticsPeriod
                period={period}
                description={say(dashboardReportMessages.period)}
                errors={errors}
                onSubmit={count}
              >
                <RadioGroup
                  label={say(words.unit)}
                  name='period'
                  options={options(TREND_UNITS)}
                  description={say(words.unitHelp)}
                  value={chosen.unit}
                  onChange={(event) =>
                    setChosen({ asked, unit: trendUnitOf(event.target.value) })
                  }
                />
              </StatisticsPeriod>
              <p>{say(words.of(periodNameOf(period)))}</p>
              {match(counted)
                .with(undefined, () => (
                  <LoadingIndicator
                    label={say(dashboardReportMessages.counting)}
                  />
                ))
                .with({ type: 'found' }, ({ trends }) =>
                  trends.transactions.every((count) => count === 0) ? (
                    <EmptyState
                      title={say(dashboardReportMessages.noSales)}
                      description={say(dashboardReportMessages.changePeriod)}
                    />
                  ) : (
                    <SalesTrend
                      parts={partsOf(trends)}
                      unit={unit}
                      currency={salon.currency}
                    />
                  ),
                )
                .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
                  <UnreadNotice
                    message={say(unreadMessageOf(names.read.trends, reason))}
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

/** The trends of the sales of the salon of the address. */
export const SalesTrendsScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.trends)}>
      {(salon) => <TrendsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
