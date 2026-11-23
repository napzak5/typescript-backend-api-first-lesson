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
import { readSalesByStaff, salesByStaffKeyOf } from '../api/sales-report-api'
import { StaffSales } from '../components/staff-sales/staff-sales'
import { usePeriodCount } from '../hooks/use-period-count'
import { ReportRefusal } from './report-refusal'

const { names, staff: words, titles } = dashboardReportMessages

/**
 * The sales of every member of the staff of the salon over a period: the
 * month up to today at the salon, or the days in the query of the address.
 * They are read whenever the screen is shown, and what an earlier screen
 * read is not shown meanwhile.
 */
const StaffPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const { period, errors, count, read, shown } = usePeriodCount(
    salon,
    (counted) => salesByStaffKeyOf(salon.id, counted),
    (counted) => readSalesByStaff(salon.id, counted),
  )

  return (
    <>
      <PageHeader title={say(titles.staff)} description={salon.name} />
      {match(shown)
        .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
          <ReportRefusal refusal={type} what={names.seen.staff} />
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
                .with({ type: 'found', staff: [] }, () => (
                  <EmptyState
                    title={say(words.none)}
                    description={say(dashboardReportMessages.changePeriod)}
                  />
                ))
                .with({ type: 'found' }, ({ staff }) => (
                  <StaffSales staff={staff} currency={salon.currency} />
                ))
                .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
                  <UnreadNotice
                    message={say(unreadMessageOf(names.read.staff, reason))}
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
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.staff)}>
      {(salon) => <StaffPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
