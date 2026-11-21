import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  periodNameOf,
  StatisticsPeriod,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { CategorySales } from './components/category-sales/category-sales'
import { ReportRefusal } from './report-refusal'
import { REPORT_PERIOD } from './sales-report'
import { readSalesByCategory, salesByCategoryKeyOf } from './sales-report-api'
import { usePeriodCount } from './use-period-count'

const TITLE = '区分別の売上'

const UNREAD = P.union('tooManyRequests', 'failed')

/**
 * The sales of services of the salon over a period by kind of service:
 * the month up to today at the salon, or the days in the query of the
 * address. They are read whenever the screen is shown, and what an earlier
 * screen read is not shown meanwhile.
 */
const CategoriesPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const { period, errors, count, read, shown } = usePeriodCount(
    salon,
    (counted) => salesByCategoryKeyOf(salon.id, counted),
    (counted) => readSalesByCategory(salon.id, counted),
  )

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match(shown)
        .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
          <ReportRefusal refusal={type} what={TITLE} />
        ))
        .with(
          P.union(undefined, { type: P.union('found', UNREAD) }),
          (counted) => (
            <>
              <StatisticsPeriod
                period={period}
                description={REPORT_PERIOD}
                errors={errors}
                onSubmit={count}
              />
              <p>{`${periodNameOf(period)}のメニューの区分別の売上`}</p>
              {match(counted)
                .with(undefined, () => (
                  <LoadingIndicator label='売上を集計しています' />
                ))
                .with({ type: 'found', categories: [] }, () => (
                  <EmptyState
                    title='この期間のメニューの売上はありません'
                    description='期間を変えて集計してください。'
                  />
                ))
                .with({ type: 'found' }, ({ categories }) => (
                  <CategorySales
                    categories={categories}
                    currency={salon.currency}
                  />
                ))
                .with({ type: UNREAD }, (reason) => (
                  <UnreadNotice
                    message={unreadMessageOf(TITLE, reason)}
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
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <CategoriesPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
