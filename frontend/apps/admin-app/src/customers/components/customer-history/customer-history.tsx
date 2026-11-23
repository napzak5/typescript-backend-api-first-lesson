import type { ModelsCustomerHistoryEntryResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { operationNameOf } from '../../utils/customer-history'
import { changedTermsOf } from '../customer-record/ledger-items'

const { history: words } = adminCustomerMessages

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
  /** Who made a version, as the salon can tell; `null` for nobody: the values the history began with */
  changerOf: (changedBy: string | null) => LocalizedText | null
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
}: ModelsCustomerHistoryEntryResponse): LocalizedText | null =>
  changes === null
    ? null
    : words.changedItems(changedTermsOf(changes.map(({ field }) => field)))

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
}: CustomerHistoryProps) => {
  const say = useSay()
  const sayIfAny = (message: LocalizedText | null): string =>
    message === null ? '' : say(message)

  return (
    <PagedTable
      caption={say(words.caption)}
      columns={[
        {
          key: 'version',
          header: say(words.version),
          cell: ({ version }) => (
            <Link href={versionHref(version)}>
              {say(words.versionOf(version))}
            </Link>
          ),
        },
        {
          key: 'operation',
          header: say(words.operation),
          cell: ({ operation }) => say(operationNameOf(operation)),
        },
        {
          key: 'changedAt',
          header: say(words.changedAt),
          cell: ({ changedAt }) => say(momentNameAt(changedAt, timezone)),
        },
        {
          key: 'changedBy',
          header: say(words.changedBy),
          cell: ({ changedBy }) => sayIfAny(changerOf(changedBy)),
        },
        {
          key: 'changes',
          header: say(words.changes),
          cell: (entry) => sayIfAny(changedNameOf(entry)),
        },
      ]}
      rows={entries}
      rowKey={({ id }) => id}
      emptyMessage={say(words.empty)}
      count={say(countOf(total, entries.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
