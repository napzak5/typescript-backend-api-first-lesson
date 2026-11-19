import type { ModelsBookingServiceResponse } from '@beauty-salon-frontend/api-client'
import { Card, DescriptionList } from '@beauty-salon-frontend/ui'
import { dayAt, dayNameOf, momentNameAt } from '../../../salon-time'
import { amountOf, hoursOf } from '../../booking-format'
import { memberNameOf, type Names, serviceNameOf } from '../../day-bookings'

export type BookingLineRecordProps = {
  line: ModelsBookingServiceResponse
  staff: Names['staff']
  services: Names['services']
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
}

/**
 * A line of a booking, as the salon keeps it: the service, who does it,
 * when and for how long, what it costs with its discount, whether it was
 * done, and the note. The amounts are those of the service when the line
 * was put in.
 */
export const BookingLineRecord = ({
  line,
  staff,
  services,
  timezone,
  currency,
}: BookingLineRecordProps) => (
  <Card title='施術明細'>
    <DescriptionList
      items={[
        {
          term: 'メニュー',
          description: serviceNameOf(line.serviceId, services),
        },
        { term: '担当', description: memberNameOf(line.staffId, staff) },
        {
          term: '時刻',
          description: `${dayNameOf(dayAt(new Date(line.startTime), timezone))} ${hoursOf(line, timezone)}`,
        },
        { term: '所要時間', description: `${line.duration} 分` },
        { term: '料金', description: amountOf(line.price, currency) },
        { term: '割引', description: amountOf(line.discountAmount, currency) },
        {
          term: '支払う額',
          description: `${amountOf(line.finalPrice, currency)}${line.taxIncluded ? '（税込）' : '（税別）'}`,
        },
        {
          term: '完了',
          description: line.isCompleted
            ? `済み${line.completedAt === null ? '' : `（${momentNameAt(line.completedAt, timezone)}）`}`
            : '未',
        },
        { term: 'メモ', description: line.notes ?? 'なし' },
      ]}
    />
  </Card>
)
