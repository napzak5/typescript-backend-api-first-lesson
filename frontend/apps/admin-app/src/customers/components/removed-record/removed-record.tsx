import type { ModelsCustomerVersionResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Actions,
  Alert,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  Link,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { Removal } from '../../api/customer-history-api'
import { whyUnrestorable } from '../../utils/customer-history'
import { ledgerItemsOf } from '../customer-record/ledger-items'
import styles from './removed-record.module.css'

export type RemovedRecordProps = {
  /** The latest version of the customer: what the ledger held when they left */
  version: ModelsCustomerVersionResponse
  /** How the customer left the ledger */
  removal: Removal
  /** Who took them out, as the salon can tell: 「あなた」 */
  changer: string
  /** The time zone of the salon: the time is that of its clock */
  timezone: string
  /** The address of the history of the customer */
  historyHref: string
  /** The address of the page of another customer: the one who referred this one */
  customerHref: (customerId: string) => string
  /** Why the customer did not come back; `link` leads to what is to be changed first */
  refusal?:
    | { message: string; link?: { href: string; label: string } }
    | undefined
  /** The customer is being brought back */
  pending?: boolean | undefined
  /** The button that brings the customer back was pressed */
  onRestore: () => void
}

/**
 * A customer who left the ledger, as their latest version keeps them: when
 * and by whom they left, and the values they had. One who was removed can
 * be brought back; one who was merged into another or erased cannot, and
 * the page says why.
 */
export const RemovedRecord = ({
  version,
  removal,
  changer,
  timezone,
  historyHref,
  customerHref,
  refusal,
  pending = false,
  onRestore,
}: RemovedRecordProps) => {
  const when = momentNameAt(version.changedAt, timezone)
  const why = whyUnrestorable(removal)
  const done = match(removal)
    .with('deleted', () => '台帳から削除しました')
    .with('merged', () => 'ほかのお客様に統合しました')
    .with('erased', () => '削除の依頼で消去しました')
    .exhaustive()

  return (
    <div className={styles['removed']}>
      <p>{`${when} に、${changer}が${done}。`}</p>
      {why !== undefined && <p>{why}</p>}
      {refusal !== undefined && (
        <Alert tone='danger'>
          {refusal.message}
          {refusal.link !== undefined && (
            <>
              {' '}
              <Link href={refusal.link.href}>{refusal.link.label}</Link>
            </>
          )}
        </Alert>
      )}
      <Actions>
        {why === undefined && (
          <Button variant='primary' pending={pending} onClick={onRestore}>
            台帳に戻す
          </Button>
        )}
        <ButtonLink href={historyHref}>変更履歴</ButtonLink>
      </Actions>
      <Card title='削除されたときの台帳'>
        <DescriptionList
          items={ledgerItemsOf(
            version,
            version.referredBy === null ? null : (
              <Link href={customerHref(version.referredBy)}>
                紹介したお客様
              </Link>
            ),
          )}
        />
      </Card>
    </div>
  )
}
