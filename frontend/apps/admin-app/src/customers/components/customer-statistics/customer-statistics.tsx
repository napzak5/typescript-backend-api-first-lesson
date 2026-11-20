import type { ModelsCustomerStatisticsResponse } from '@beauty-salon-frontend/api-client'
import { DescriptionList, Table } from '@beauty-salon-frontend/ui'
import { amountOf } from '../../../bookings/booking-format'
import { momentNameAt } from '../../../salon-time'
import { countNameOf, rateNameOf } from '../../customer-format'
import styles from './customer-statistics.module.css'

export type CustomerStatisticsProps = {
  statistics: ModelsCustomerStatisticsResponse
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
}

const NO_VISIT = 'この期間に完了した予約はありません'

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
}: CustomerStatisticsProps) => (
  <div className={styles['statistics']}>
    <DescriptionList
      items={[
        {
          term: '予約',
          description: countNameOf(statistics.totalBookings, '件'),
        },
        {
          term: '利用額',
          description: amountOf(statistics.totalSpent, currency),
        },
        {
          term: '予約 1 件あたりの会計',
          description: amountOf(statistics.averageBookingValue, currency),
        },
        {
          term: '最後の来店',
          description:
            statistics.lastVisit === null
              ? 'なし'
              : momentNameAt(statistics.lastVisit, timezone),
        },
        {
          term: 'キャンセル率',
          description: rateNameOf(statistics.cancellationRate),
        },
        {
          term: '無断キャンセル率',
          description: rateNameOf(statistics.noShowRate),
        },
      ]}
    />
    <Table
      caption='よく受けたメニュー'
      columns={[
        { key: 'name', header: 'メニュー', cell: ({ name }) => name },
        {
          key: 'bookingCount',
          header: '予約',
          align: 'end',
          cell: ({ bookingCount }) => countNameOf(bookingCount, '件'),
        },
      ]}
      rows={statistics.favoriteServices}
      rowKey={({ serviceId }) => serviceId}
      emptyMessage={NO_VISIT}
    />
    <Table
      caption='よく担当したスタッフ'
      columns={[
        {
          key: 'displayName',
          header: 'スタッフ',
          cell: ({ displayName }) => displayName,
        },
        {
          key: 'bookingCount',
          header: '予約',
          align: 'end',
          cell: ({ bookingCount }) => countNameOf(bookingCount, '件'),
        },
      ]}
      rows={statistics.favoriteStaff}
      rowKey={({ staffId }) => staffId}
      emptyMessage={NO_VISIT}
    />
  </div>
)
