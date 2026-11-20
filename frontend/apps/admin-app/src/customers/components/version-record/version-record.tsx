import type { ModelsCustomerVersionResponse } from '@beauty-salon-frontend/api-client'
import { Card, DescriptionList, Link, Table } from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { momentNameAt } from '../../../salon-time'
import { operationNameOf } from '../../customer-history'
import {
  changedItemsOf,
  type LedgerValues,
  ledgerItemsOf,
} from '../customer-record/ledger-items'
import styles from './version-record.module.css'

export type VersionRecordProps = {
  version: ModelsCustomerVersionResponse
  /**
   * The version before it, for an update or a merge: what it changed is
   * shown beside it. `undefined` for any other version, and while the one
   * before is not read
   */
  previous: ModelsCustomerVersionResponse | undefined
  /** Who made the version, as the salon can tell; empty for the values the history began with */
  changer: string
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
  const referrerOf = ({ referredBy }: LedgerValues): ReactNode =>
    referredBy === null ? null : (
      <Link href={customerHref(referredBy)}>紹介したお客様</Link>
    )
  const changed =
    previous === undefined ? [] : changedItemsOf(previous, version, referrerOf)

  return (
    <div className={styles['version']}>
      <p>
        {[
          `版 ${version.version}`,
          operationNameOf(version.operation),
          momentNameAt(version.changedAt, timezone),
          ...(changer === '' ? [] : [changer]),
        ].join('・')}
      </p>
      {previous !== undefined &&
        (changed.length === 0 ? (
          <p>前の版から、値は変わっていません。</p>
        ) : (
          <Table
            caption='前の版から変えた項目'
            columns={[
              { key: 'term', header: '項目', cell: ({ term }) => term },
              { key: 'before', header: '前の版', cell: ({ before }) => before },
              { key: 'after', header: 'この版', cell: ({ after }) => after },
            ]}
            rows={changed}
            rowKey={({ term }) => term}
            emptyMessage='変えた項目はありません'
          />
        ))}
      <Card title='この版の台帳'>
        <DescriptionList items={ledgerItemsOf(version, referrerOf(version))} />
      </Card>
    </div>
  )
}
