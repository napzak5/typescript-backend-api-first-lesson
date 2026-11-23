import type { ModelsCustomerStatisticsResponse } from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { DescriptionList, NONE, Table, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { rateNameOf } from '../../utils/customer-format'
import styles from './customer-statistics.module.css'

export type CustomerStatisticsProps = {
  statistics: ModelsCustomerStatisticsResponse
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
}

const { use: words } = adminCustomerMessages

/**
 * What a customer did at the salon over a period: how often they booked,
 * what they spent, when they last came, how often they cancelled or did
 * not come, and the services and the members of the staff of the bookings
 * they came for, the most often first.
 */
export const CustomerStatistics = ({
  statistics,
  timezone,
  currency,
}: CustomerStatisticsProps) => {
  const say = useSay()

  return (
    <div className={styles['statistics']}>
      <DescriptionList
        items={[
          {
            term: say(words.bookings),
            description: say(words.bookingsOf(statistics.totalBookings)),
          },
          {
            term: say(words.spent),
            description: say(amountOf(statistics.totalSpent, currency)),
          },
          {
            term: say(words.averagePerBooking),
            description: say(
              amountOf(statistics.averageBookingValue, currency),
            ),
          },
          {
            term: say(words.lastVisit),
            description: say(
              statistics.lastVisit === null
                ? NONE
                : momentNameAt(statistics.lastVisit, timezone),
            ),
          },
          {
            term: say(words.cancellationRate),
            description: say(rateNameOf(statistics.cancellationRate)),
          },
          {
            term: say(words.noShowRate),
            description: say(rateNameOf(statistics.noShowRate)),
          },
        ]}
      />
      <Table
        caption={say(words.favoriteServices)}
        columns={[
          { key: 'name', header: say(words.service), cell: ({ name }) => name },
          {
            key: 'bookingCount',
            header: say(words.bookings),
            align: 'end',
            cell: ({ bookingCount }) => say(words.bookingsOf(bookingCount)),
          },
        ]}
        rows={statistics.favoriteServices}
        rowKey={({ serviceId }) => serviceId}
        emptyMessage={say(words.noVisit)}
      />
      <Table
        caption={say(words.favoriteStaff)}
        columns={[
          {
            key: 'displayName',
            header: say(words.staff),
            cell: ({ displayName }) => displayName,
          },
          {
            key: 'bookingCount',
            header: say(words.bookings),
            align: 'end',
            cell: ({ bookingCount }) => say(words.bookingsOf(bookingCount)),
          },
        ]}
        rows={statistics.favoriteStaff}
        rowKey={({ staffId }) => staffId}
        emptyMessage={say(words.noVisit)}
      />
    </div>
  )
}
