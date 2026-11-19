import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
} from '@beauty-salon-frontend/api-client'
import { Card, DescriptionList, Link, Table } from '@beauty-salon-frontend/ui'
import { customerNameOf } from '../../../customers/customers-api'
import { dayNameOf, momentNameAt } from '../../../salon-time'
import { NO_RECORD, sourceNameOf } from '../../booking-entry'
import {
  amountOf,
  GONE_CUSTOMER,
  hoursOf,
  UNLISTED_STAFF,
} from '../../booking-format'
import {
  memberNameOf,
  type Names,
  serviceNameOf,
  staffNameOf,
} from '../../day-bookings'
import styles from './booking-record.module.css'

export type BookingRecordProps = {
  booking: ModelsBookingResponse
  /** `null`: the customer was removed */
  customer: Pick<
    ModelsCustomerResponse,
    'lastName' | 'firstName' | 'phoneNumber'
  > | null
  staff: Names['staff']
  services: Names['services']
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
  /** The address of the page of a line of the booking */
  lineHrefOf: (lineId: string) => string
}

const NONE = 'なし'

/**
 * What the salon keeps of a booking: who comes when, for what, with whom,
 * what it comes to, and what happened to it. What the salon leaves empty
 * is said to be so; what has not happened yet (a cancellation, the times
 * the treatment actually took) is not shown.
 */
export const BookingRecord = ({
  booking,
  customer,
  staff,
  services,
  timezone,
  currency,
  lineHrefOf,
}: BookingRecordProps) => {
  const happened = [
    ...(booking.cancelledAt === null
      ? []
      : [
          {
            term: 'キャンセルした日時',
            description: momentNameAt(booking.cancelledAt, timezone),
          },
          {
            term: 'キャンセルの理由',
            description: booking.cancellationReason ?? NO_RECORD,
          },
        ]),
    ...(booking.actualStartTime === null
      ? []
      : [
          {
            term: '実際の開始',
            description: momentNameAt(booking.actualStartTime, timezone),
          },
        ]),
    ...(booking.actualEndTime === null
      ? []
      : [
          {
            term: '実際の終了',
            description: momentNameAt(booking.actualEndTime, timezone),
          },
        ]),
    ...(booking.completedAt === null
      ? []
      : [
          {
            term: '完了を記録した日時',
            description: momentNameAt(booking.completedAt, timezone),
          },
        ]),
  ]

  return (
    <div className={styles['record']}>
      <Card title='予約'>
        <DescriptionList
          items={[
            { term: '予約番号', description: booking.bookingNumber },
            { term: '来店日', description: dayNameOf(booking.bookingDate) },
            { term: '時刻', description: hoursOf(booking, timezone) },
            {
              term: 'お客様',
              description:
                customer === null ? GONE_CUSTOMER : customerNameOf(customer),
            },
            ...(customer === null
              ? []
              : [
                  {
                    term: 'お客様の電話番号',
                    description: customer.phoneNumber,
                  },
                ]),
            {
              term: '担当',
              description:
                staffNameOf(booking.staffId, staff) ?? UNLISTED_STAFF,
            },
            {
              term: 'お客様の要望',
              description: booking.customerRequest ?? NONE,
            },
            {
              term: 'サロン内のメモ',
              description: booking.internalNotes ?? NONE,
            },
            {
              term: '受付の経路',
              description:
                booking.source === null
                  ? NO_RECORD
                  : sourceNameOf(booking.source),
            },
            {
              term: '予約金',
              description:
                booking.depositAmount === null
                  ? NO_RECORD
                  : amountOf(booking.depositAmount, currency),
            },
            ...happened,
          ]}
        />
      </Card>
      <Card title='施術明細'>
        <Table
          caption='施術明細'
          captionHidden
          columns={[
            {
              key: 'service',
              header: 'メニュー',
              cell: ({ id, serviceId }) => (
                <Link href={lineHrefOf(id)}>
                  {serviceNameOf(serviceId, services)}
                </Link>
              ),
            },
            {
              key: 'staff',
              header: '担当',
              cell: ({ staffId }) => memberNameOf(staffId, staff),
            },
            {
              key: 'hours',
              header: '時刻',
              cell: (line) => hoursOf(line, timezone),
            },
            {
              key: 'price',
              header: '金額',
              align: 'end',
              cell: ({ finalPrice, discountAmount, taxIncluded }) =>
                `${amountOf(finalPrice, currency)}${discountAmount > 0 ? `（割引 ${amountOf(discountAmount, currency)}）` : ''}${taxIncluded ? '（税込）' : '（税別）'}`,
            },
            {
              key: 'completed',
              header: '完了',
              cell: ({ isCompleted }) => (isCompleted ? '済み' : '未'),
            },
          ]}
          rows={booking.services.toSorted(
            (one, other) => one.sortOrder - other.sortOrder,
          )}
          rowKey={({ id }) => id}
          emptyMessage='施術明細はありません'
        />
      </Card>
      <Card title='金額'>
        <DescriptionList
          items={[
            { term: '小計', description: amountOf(booking.subtotal, currency) },
            {
              term: '割引',
              description: amountOf(booking.discountAmount, currency),
            },
            {
              term: '消費税',
              description: amountOf(booking.taxAmount, currency),
            },
            {
              term: '合計',
              description: amountOf(booking.totalAmount, currency),
            },
          ]}
        />
      </Card>
    </div>
  )
}
