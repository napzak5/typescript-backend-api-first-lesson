import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { Link } from '@beauty-salon-frontend/ui'
import { UNLISTED_STAFF } from '../../../bookings/booking-format'
import { serviceNameOf, staffNameOf } from '../../../bookings/day-bookings'
import {
  countOf,
  PagedTable,
} from '../../../components/paged-table/paged-table'
import type { More } from '../../../pages'
import { momentNameAt } from '../../../salon-time'
import {
  customerCalled,
  minutesNameOf,
  NOT_ANSWERED,
  NOT_RECORDED,
  satisfactionNameOf,
} from '../../treatment-format'
import type { FoundTreatment } from '../../treatments-api'
import styles from './treatment-table.module.css'

export type TreatmentTableProps = {
  /** What the table lists: 「施術記録」, or 「条件に合う施術記録」 */
  caption: string
  /** The records that were read so far, the latest written first; at least one */
  rows: readonly FoundTreatment[]
  /** How many records there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the records that come next */
  onMore: () => void
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The members of the staff of the salon */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** The services of the salon */
  services: readonly Pick<ModelsServiceResponse, 'id' | 'name'>[]
  /** The address of a record */
  treatmentHref: (treatmentId: string) => string
  /** The address of a customer */
  customerHref: (customerId: string) => string
}

/**
 * The treatment records that were found: each by when it was written,
 * which leads to the record, with the customer, the member of the staff,
 * the services, how long it took and how satisfied the customer was. A
 * customer who left the ledger is said to be so, without a link.
 */
export const TreatmentTable = ({
  caption,
  rows,
  total,
  more,
  onMore,
  timezone,
  staff,
  services,
  treatmentHref,
  customerHref,
}: TreatmentTableProps) => (
  <PagedTable
    caption={caption}
    columns={[
      {
        key: 'createdAt',
        header: '書いた日時',
        cell: ({ record }) => (
          <Link href={treatmentHref(record.id)}>
            {momentNameAt(record.createdAt, timezone)}
          </Link>
        ),
      },
      {
        key: 'customer',
        header: 'お客様',
        cell: ({ record, customer }) =>
          customer === undefined ? (
            customerCalled(customer)
          ) : (
            <Link href={customerHref(record.customerId)}>
              {customerCalled(customer)}
            </Link>
          ),
      },
      {
        key: 'staff',
        header: '担当',
        cell: ({ record }) =>
          staffNameOf(record.staffId, staff) ?? UNLISTED_STAFF,
      },
      {
        key: 'services',
        header: 'サービス',
        cell: ({ record }) => (
          <span className={styles['text']}>
            {record.services
              .map((serviceId) => serviceNameOf(serviceId, services))
              .join('、')}
          </span>
        ),
      },
      {
        key: 'processingTime',
        header: '施術時間',
        cell: ({ record }) =>
          record.processingTime === null
            ? NOT_RECORDED
            : minutesNameOf(record.processingTime),
      },
      {
        key: 'customerSatisfaction',
        header: '満足度',
        cell: ({ record }) =>
          record.customerSatisfaction === null
            ? NOT_ANSWERED
            : satisfactionNameOf(record.customerSatisfaction),
      },
    ]}
    rows={rows}
    rowKey={({ record }) => record.id}
    emptyMessage='施術記録はありません'
    count={countOf(total, rows.length, '件')}
    more={more}
    onMore={onMore}
  />
)
