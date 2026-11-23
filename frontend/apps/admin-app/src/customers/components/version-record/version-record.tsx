import type { ModelsCustomerVersionResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  EmptyState,
  Link,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import { operationNameOf } from '../../utils/customer-history'
import {
  changedItemsOf,
  type LedgerValues,
  ledgerItemsOf,
} from '../customer-record/ledger-items'
import styles from './version-record.module.css'

const { history, referrer, version: words } = adminCustomerMessages

export type VersionRecordProps = {
  version: ModelsCustomerVersionResponse
  /**
   * The version before it, for an update or a merge: what it changed is
   * shown beside it. `undefined` for any other version, and while the one
   * before is not read
   */
  previous: ModelsCustomerVersionResponse | undefined
  /** Who made the version, as the salon can tell; `null` for the values the history began with */
  changer: LocalizedText | null
  /** The time zone of the salon: the time is that of its clock */
  timezone: string
  /** The address of the page of another customer: the one who referred this one */
  customerHref: (customerId: string) => string
}

/**
 * A version of a customer: what made it, when and by whom; what it changed,
 * the value before beside the value after; and every value the ledger held
 * then, as the page of a customer shows them.
 */
export const VersionRecord = ({
  version,
  previous,
  changer,
  timezone,
  customerHref,
}: VersionRecordProps) => {
  const say = useSay()
  const referrerOf = ({ referredBy }: LedgerValues): ReactNode =>
    referredBy === null ? null : (
      <Link href={customerHref(referredBy)}>{say(referrer.link)}</Link>
    )
  const changed =
    previous === undefined
      ? []
      : changedItemsOf(previous, version, referrerOf, say)

  return (
    <div className={styles['version']}>
      <p>
        {say(
          words.line([
            history.versionOf(version.version),
            operationNameOf(version.operation),
            momentNameAt(version.changedAt, timezone),
            ...(changer === null ? [] : [changer]),
          ]),
        )}
      </p>
      {previous !== undefined &&
        (changed.length === 0 ? (
          <EmptyState kind='part' title={say(words.unchanged)} />
        ) : (
          <Table
            caption={say(words.changedCaption)}
            columns={[
              {
                key: 'term',
                header: say(words.item),
                cell: ({ term }) => term,
              },
              {
                key: 'before',
                header: say(words.before),
                cell: ({ before }) => before,
              },
              {
                key: 'after',
                header: say(words.after),
                cell: ({ after }) => after,
              },
            ]}
            rows={changed}
            rowKey={({ term }) => term}
            emptyMessage={say(words.noChangedItems)}
          />
        ))}
      <Card title={say(words.recordTitle)}>
        <DescriptionList
          items={ledgerItemsOf(version, referrerOf(version), say)}
        />
      </Card>
    </div>
  )
}
