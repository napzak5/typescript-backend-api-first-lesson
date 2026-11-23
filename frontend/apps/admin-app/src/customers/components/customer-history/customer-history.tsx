import type { ModelsCustomerHistoryEntryResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  COUNTED,
  countOf,
  inJapanese,
  Link,
  type More,
  NONE,
} from '@beauty-salon-frontend/ui'
import { operationNameOf } from '../../utils/customer-history'
import { changedTermsOf } from '../customer-record/ledger-items'

export type CustomerHistoryProps = {
  /** The versions that were read so far, the latest first; at least one */
  entries: readonly ModelsCustomerHistoryEntryResponse[]
  /** How many versions the customer has; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the versions that come next */
  onMore: () => void
  /** The address of a version */
  versionHref: (version: number) => string
  /** Who made a version, as the salon can tell */
  changerOf: (changedBy: string | null) => string
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
}

/**
 * What a version changed, by the items of the ledger: those an update or
 * a merge changed, 「なし」 for an update that changed no value, nothing
 * for a version that is the whole record (a registration, a removal).
 */
const changedNameOf = ({
  changes,
}: ModelsCustomerHistoryEntryResponse): string => {
  if (changes === null) {
    return ''
  }
  const terms = changedTermsOf(changes.map(({ field }) => field))

  return terms.length === 0 ? inJapanese(NONE) : terms.join('、')
}

/**
 * The versions of a customer, the latest first: what made each, when, by
 * whom and which items of the ledger it changed. The number leads to the
 * version and its values.
 */
export const CustomerHistory = ({
  entries,
  total,
  more,
  onMore,
  versionHref,
  changerOf,
  timezone,
}: CustomerHistoryProps) => (
  <PagedTable
    caption='版の一覧'
    columns={[
      {
        key: 'version',
        header: '版',
        cell: ({ version }) => (
          <Link href={versionHref(version)}>{`版 ${version}`}</Link>
        ),
      },
      {
        key: 'operation',
        header: '操作',
        cell: ({ operation }) => operationNameOf(operation),
      },
      {
        key: 'changedAt',
        header: '日時',
        cell: ({ changedAt }) => inJapanese(momentNameAt(changedAt, timezone)),
      },
      {
        key: 'changedBy',
        header: '変更者',
        cell: ({ changedBy }) => changerOf(changedBy),
      },
      { key: 'changes', header: '変えた項目', cell: changedNameOf },
    ]}
    rows={entries}
    rowKey={({ id }) => id}
    emptyMessage='版はありません'
    count={inJapanese(countOf(total, entries.length, COUNTED.items))}
    more={more}
    onMore={onMore}
  />
)
