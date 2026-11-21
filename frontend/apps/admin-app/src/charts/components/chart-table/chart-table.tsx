import {
  countOf,
  type More,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import { Link } from '@beauty-salon-frontend/ui'
import { UNRECORDED } from '../../../customers/customer-format'
import { tagsTextOf } from '../../../customers/customer-ledger'
import { customerNameOf } from '../../../customers/customers-api'
import type { FoundChart } from '../../charts-api'
import styles from './chart-table.module.css'

export type ChartTableProps = {
  /** What the table lists: 「カルテ」, or 「条件に合うカルテ」 */
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

/** Text that breaks its lines in its cell */
const textCell = (text: string) => (
  <span className={styles['text']}>{text}</span>
)

/** The names of products, as the form takes them */
const productsOrNone = (names: readonly string[]) =>
  names.length === 0 ? UNRECORDED : textCell(tagsTextOf(names))

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
}: ChartTableProps) => (
  <PagedTable
    caption={caption}
    columns={[
      {
        key: 'customer',
        header: 'お客様',
        cell: ({ chart, customer }) =>
          customer === undefined ? (
            '台帳から削除されたお客様'
          ) : (
            <Link href={chartHref(chart.customerId)}>
              {`${customerNameOf(customer)} 様`}
            </Link>
          ),
      },
      {
        key: 'medicalConditions',
        header: '持病や体調',
        cell: ({ chart }) =>
          chart.medicalConditions === null
            ? UNRECORDED
            : textCell(chart.medicalConditions),
      },
      {
        key: 'preferredProducts',
        header: '好みの商材',
        cell: ({ chart }) => productsOrNone(chart.preferredProducts),
      },
      {
        key: 'avoidProducts',
        header: '避ける商材',
        cell: ({ chart }) => productsOrNone(chart.avoidProducts),
      },
      {
        key: 'updatedAt',
        header: '最後に書いた日時',
        cell: ({ chart }) => momentNameAt(chart.updatedAt, timezone),
      },
    ]}
    rows={rows}
    rowKey={({ chart }) => chart.id}
    emptyMessage='カルテはありません'
    count={countOf(total, rows.length, '件')}
    more={more}
    onMore={onMore}
  />
)
