import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  adminMenuMessages,
  adminStaffMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import {
  serviceNameOf,
  staffNameOf,
} from '../../../bookings/utils/day-bookings'
import type { FoundTreatment } from '../../api/treatments-api'
import {
  customerCalled,
  satisfactionNameOf,
} from '../../utils/treatment-format'

const { table: WORDS } = adminTreatmentMessages

export type TreatmentTableProps = {
  /** What the table lists, in the language of the page: 「施術記録」, or 「条件に合う施術記録」 */
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
}: TreatmentTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={caption}
      columns={[
        {
          key: 'createdAt',
          header: say(WORDS.writtenAt),
          cell: ({ record }) => (
            <Link href={treatmentHref(record.id)}>
              {say(momentNameAt(record.createdAt, timezone))}
            </Link>
          ),
        },
        {
          key: 'customer',
          header: say(WORDS.customer),
          cell: ({ record, customer }) =>
            customer === undefined ? (
              say(customerCalled(customer))
            ) : (
              <Link href={customerHref(record.customerId)}>
                {say(customerCalled(customer))}
              </Link>
            ),
        },
        {
          key: 'staff',
          header: say(WORDS.staff),
          cell: ({ record }) =>
            staffNameOf(record.staffId, staff) ??
            say(adminStaffMessages.unlisted),
        },
        {
          key: 'services',
          header: say(WORDS.services),
          wrap: 'words',
          cell: ({ record }) =>
            say(
              WORDS.servicesOf(
                record.services.map(
                  (serviceId) =>
                    serviceNameOf(serviceId, services) ??
                    say(adminMenuMessages.removedService),
                ),
              ),
            ),
        },
        {
          key: 'processingTime',
          header: say(WORDS.processingTime),
          cell: ({ record }) =>
            record.processingTime === null
              ? null
              : say(formats.minutesOf(record.processingTime)),
        },
        {
          key: 'customerSatisfaction',
          header: say(WORDS.satisfaction),
          cell: ({ record }) =>
            say(
              record.customerSatisfaction === null
                ? WORDS.notAnswered
                : satisfactionNameOf(record.customerSatisfaction),
            ),
        },
      ]}
      rows={rows}
      rowKey={({ record }) => record.id}
      emptyMessage={say(WORDS.none)}
      count={say(countOf(total, rows.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
