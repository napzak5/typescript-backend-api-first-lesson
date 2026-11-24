import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  COUNTED,
  countOf,
  Link,
  type More,
  NONE,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminChartMessages,
  adminCustomerMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { customerNameOf } from '../../../customers/api/customers-api'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import type { FoundChart } from '../../api/charts-api'

const { search: SEARCH, words } = adminChartMessages

export type ChartTableProps = {
  /** What the table lists, in the language of the page: 「カルテ」, or 「条件に合うカルテ」 */
  caption: string
  /** The charts that were read so far, the latest made first; at least one */
  rows: readonly FoundChart[]
  /** How many charts there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the charts that come next */
  onMore: () => void
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The address of the chart of a customer */
  chartHref: (customerId: string) => string
}

/** The names of products, as the form takes them */
const productsOrNone = (names: readonly string[]): LocalizedText =>
  names.length === 0 ? NONE : tagsTextOf(names)

/**
 * The charts that were found: each by the name of its customer, which
 * leads to the chart, with what to take care of, the products the
 * customer likes and avoids, and when the chart was last written. A
 * customer who left the ledger meanwhile is said to be so, without a link.
 */
export const ChartTable = ({
  caption,
  rows,
  total,
  more,
  onMore,
  timezone,
  chartHref,
}: ChartTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={caption}
      columns={[
        {
          key: 'customer',
          header: say(words.customer),
          cell: ({ chart, customer }) =>
            customer === undefined ? (
              say(adminTreatmentMessages.removedCustomer)
            ) : (
              <Link href={chartHref(chart.customerId)}>
                {say(
                  adminCustomerMessages.naming.honored(
                    customerNameOf(customer),
                  ),
                )}
              </Link>
            ),
        },
        {
          key: 'medicalConditions',
          header: say(words.medicalConditions),
          wrap: 'lines',
          cell: ({ chart }) => chart.medicalConditions,
        },
        {
          key: 'preferredProducts',
          header: say(words.preferredProducts),
          wrap: 'words',
          cell: ({ chart }) => say(productsOrNone(chart.preferredProducts)),
        },
        {
          key: 'avoidProducts',
          header: say(words.avoidProducts),
          wrap: 'words',
          cell: ({ chart }) => say(productsOrNone(chart.avoidProducts)),
        },
        {
          key: 'updatedAt',
          header: say(words.updatedAt),
          cell: ({ chart }) => say(momentNameAt(chart.updatedAt, timezone)),
        },
      ]}
      rows={rows}
      rowKey={({ chart }) => chart.id}
      emptyMessage={say(SEARCH.none)}
      count={say(countOf(total, rows.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
