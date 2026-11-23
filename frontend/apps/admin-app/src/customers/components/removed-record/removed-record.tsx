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
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Removal } from '../../api/customer-history-api'
import { whyUnrestorable } from '../../utils/customer-history'
import { ledgerItemsOf } from '../customer-record/ledger-items'
import styles from './removed-record.module.css'

const { removed: words, referrer } = adminCustomerMessages

export type RemovedRecordProps = {
  /** The latest version of the customer: what the ledger held when they left */
  version: ModelsCustomerVersionResponse
  /** How the customer left the ledger */
  removal: Removal
  /** Who took them out, as the salon can tell: 「あなた」; `null` for nobody it can name */
  changer: LocalizedText | null
  /** The time zone of the salon: the time is that of its clock */
  timezone: string
  /** The address of the history of the customer */
  historyHref: string
  /** The address of the page of another customer: the one who referred this one */
  customerHref: (customerId: string) => string
  /** Why the customer did not come back; `link` leads to what is to be changed first */
  refusal?:
    | { message: LocalizedText; link?: { href: string; label: LocalizedText } }
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
  const say = useSay()
  const why = whyUnrestorable(removal)

  return (
    <div className={styles['removed']}>
      <p>
        {say(
          words.done(
            momentNameAt(version.changedAt, timezone),
            changer,
            removal,
          ),
        )}
      </p>
      {why !== undefined && <p>{say(why)}</p>}
      {refusal !== undefined && (
        <Alert tone='danger'>
          {say(refusal.message)}
          {refusal.link !== undefined && (
            <>
              {' '}
              <Link href={refusal.link.href}>{say(refusal.link.label)}</Link>
            </>
          )}
        </Alert>
      )}
      <Actions>
        {why === undefined && (
          <Button variant='primary' pending={pending} onClick={onRestore}>
            {say(words.restore)}
          </Button>
        )}
        <ButtonLink href={historyHref}>{say(words.history)}</ButtonLink>
      </Actions>
      <Card title={say(words.recordTitle)}>
        <DescriptionList
          items={ledgerItemsOf(
            version,
            version.referredBy === null ? null : (
              <Link href={customerHref(version.referredBy)}>
                {say(referrer.link)}
              </Link>
            ),
            say,
          )}
        />
      </Card>
    </div>
  )
}
