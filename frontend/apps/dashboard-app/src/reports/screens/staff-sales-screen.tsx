import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  periodNameOf,
  StatisticsPeriod,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  EmptyState,
  inJapanese,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { readSalesByStaff, salesByStaffKeyOf } from '../api/sales-report-api'
import { StaffSales } from '../components/staff-sales/staff-sales'
import { usePeriodCount } from '../hooks/use-period-count'
import { REPORT_PERIOD } from '../utils/sales-report'
import { ReportRefusal } from './report-refusal'

const TITLE = 'スタッフ別の売上'

/**
 * The sales of every member of the staff of the salon over a period: the
 * month up to today at the salon, or the days in the query of the address.
 * They are read whenever the screen is shown, and what an earlier screen
 * read is not shown meanwhile.
 */
const StaffPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const { period, errors, count, read, shown } = usePeriodCount(
    salon,
    (counted) => salesByStaffKeyOf(salon.id, counted),
    (counted) => readSalesByStaff(salon.id, counted),
  )

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match(shown)
        .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
          <ReportRefusal refusal={type} what={TITLE} />
        ))
        .with(
          P.union(undefined, {
            type: P.union('found', P.union(...UNREAD_TYPES)),
          }),
          (counted) => (
            <>
              <StatisticsPeriod
                period={period}
                description={REPORT_PERIOD}
                errors={errors}
                onSubmit={count}
              />
              <p>{`${periodNameOf(period)}のスタッフ別の売上`}</p>
              {match(counted)
                .with(undefined, () => (
                  <LoadingIndicator label='売上を集計しています' />
                ))
                .with({ type: 'found', staff: [] }, () => (
                  <EmptyState
                    title='この期間に、スタッフが担当した売上はありません'
                    description='期間を変えて集計してください。'
                  />
                ))
                .with({ type: 'found' }, ({ staff }) => (
                  <StaffSales staff={staff} currency={salon.currency} />
                ))
                .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
                  <UnreadNotice
                    message={inJapanese(
                      unreadMessageOf(writtenInJapanese(TITLE), reason),
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

/** The sales of every member of the staff of the salon of the address. */
export const StaffSalesScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <StaffPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
