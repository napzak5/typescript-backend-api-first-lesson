import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  periodNameOf,
  StatisticsPeriod,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  readSalesByCategory,
  salesByCategoryKeyOf,
} from '../api/sales-report-api'
import { CategorySales } from '../components/category-sales/category-sales'
import { usePeriodCount } from '../hooks/use-period-count'
import { ReportRefusal } from './report-refusal'

const { categories: words, names, titles } = dashboardReportMessages

/**
 * The sales of services of the salon over a period by kind of service:
 * the month up to today at the salon, or the days in the query of the
 * address. They are read whenever the screen is shown, and what an earlier
 * screen read is not shown meanwhile.
 */
const CategoriesPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const { period, errors, count, read, shown } = usePeriodCount(
    salon,
    (counted) => salesByCategoryKeyOf(salon.id, counted),
    (counted) => readSalesByCategory(salon.id, counted),
  )

  return (
    <>
      <PageHeader title={say(titles.categories)} description={salon.name} />
      {match(shown)
        .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
          <ReportRefusal refusal={type} what={names.seen.categories} />
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
              />
              <p>{say(words.of(periodNameOf(period)))}</p>
              {match(counted)
                .with(undefined, () => (
                  <LoadingIndicator
                    label={say(dashboardReportMessages.counting)}
                  />
                ))
                .with({ type: 'found', categories: [] }, () => (
                  <EmptyState
                    title={say(words.none)}
                    description={say(dashboardReportMessages.changePeriod)}
                  />
                ))
                .with({ type: 'found' }, ({ categories }) => (
                  <CategorySales
                    categories={categories}
                    currency={salon.currency}
                  />
                ))
                .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
                  <UnreadNotice
                    message={say(
                      unreadMessageOf(names.read.categories, reason),
                    )}
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

/** The sales of every kind of service of the salon of the address. */
export const CategorySalesScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.categories)}>
      {(salon) => <CategoriesPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
