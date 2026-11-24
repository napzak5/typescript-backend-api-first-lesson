import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  BulletList,
  Button,
  Dialog,
  FieldRow,
  Link,
  RadioGroup,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import { customerNameOf } from '../../api/customers-api'
import {
  MERGE_WAYS,
  type MergeObstacle,
  type MergeWay,
  mergedLedgerOf,
  mergeWayNameOf,
  obstacleTextOf,
  whoIs,
} from '../../utils/customer-merge'
import {
  comparedItemsOf,
  type LedgerValues,
} from '../customer-record/ledger-items'
import styles from './customer-merge.module.css'

const { merge: words, referrer } = adminCustomerMessages
const { compared } = words

export type CustomerMergeProps = {
  /** The customer of the address */
  customer: ModelsCustomerResponse
  /** The customer chosen to merge with them */
  other: ModelsCustomerResponse
  /** Whether the customer of the address is the one kept; else the other is */
  thisKept: boolean
  onKeep: (thisKept: boolean) => void
  /** Whose value an item takes that both have, and differently */
  way: MergeWay
  onWay: (way: MergeWay) => void
  /** Why the API would refuse to merge the two; none when it would not */
  obstacles: readonly MergeObstacle[]
  /** The address of the page of a customer: the one who referred another */
  customerHref: (customerId: string) => string
  /** Why the last attempt was refused, and the two were read again: said above the choices, in the language of the page */
  refusal?: LocalizedText | undefined
  /** The dialog that asks before the two are merged is open */
  open: boolean
  /** The button that merges was pressed: the dialog is to be opened */
  onOpen: () => void
  /** The dialog has closed, or its button that changes nothing was pressed. Set `open` to false here */
  onClose: () => void
  /** What went wrong with the attempt, and may be tried again: said in the dialog, in the language of the page */
  message?: LocalizedText | undefined
  /** The merge is on its way */
  pending?: boolean | undefined
  /** The merge was confirmed */
  onMerge: () => void
}

/**
 * Two customers who are one person, to be made one: which of them is
 * kept, whose value an item takes that they have differently, the items
 * they differ in with what the merge makes of them, and what else of the
 * one merged becomes the kept one's. What the API would refuse is said
 * instead of the button; a dialog asks first, as the merge cannot be
 * taken back.
 */
export const CustomerMerge = ({
  customer,
  other,
  thisKept,
  onKeep,
  way,
  onWay,
  obstacles,
  customerHref,
  refusal,
  open,
  onOpen,
  onClose,
  message,
  pending = false,
  onMerge,
}: CustomerMergeProps) => {
  const say = useSay()
  const pair = thisKept
    ? { primary: customer, secondary: other }
    : { primary: other, secondary: customer }
  const primary = customerNameOf(pair.primary)
  const secondary = customerNameOf(pair.secondary)
  const referrerOf = ({ referredBy }: LedgerValues): ReactNode =>
    referredBy === null ? null : (
      <Link href={customerHref(referredBy)}>{say(referrer.link)}</Link>
    )
  const items = comparedItemsOf(
    pair.primary,
    pair.secondary,
    mergedLedgerOf(pair, way),
    referrerOf,
    say,
  )
  const points = pair.primary.loyaltyPoints + pair.secondary.loyaltyPoints

  return (
    <div className={styles['merge']}>
      {refusal !== undefined && <Alert tone='danger'>{say(refusal)}</Alert>}
      <FieldRow>
        <RadioGroup
          label={say(compared.kept)}
          name='kept'
          options={[
            { value: 'this', label: say(compared.thisOne(whoIs(customer))) },
            { value: 'other', label: say(compared.chosenOne(whoIs(other))) },
          ]}
          value={thisKept ? 'this' : 'other'}
          onChange={(event) => onKeep(event.currentTarget.value === 'this')}
          description={say(compared.keptDescription)}
        />
        <RadioGroup
          label={say(compared.way)}
          name='way'
          options={MERGE_WAYS.map((value) => ({
            value,
            label: say(mergeWayNameOf(value)),
          }))}
          value={way}
          onChange={(event) => {
            // The radio buttons are the ways: the one chosen is one of them
            for (const chosen of MERGE_WAYS.filter(
              (one) => one === event.currentTarget.value,
            )) {
              onWay(chosen)
            }
          }}
          description={say(compared.wayDescription)}
        />
      </FieldRow>
      {items.length === 0 ? (
        <p>{say(compared.allSame)}</p>
      ) : (
        <Table
          caption={say(compared.caption)}
          columns={[
            {
              key: 'term',
              header: say(compared.item),
              cell: ({ term }) => term,
            },
            {
              key: 'primary',
              header: say(compared.keptColumn(primary)),
              wrap: 'lines',
              cell: ({ primary: shown }) => shown,
            },
            {
              key: 'secondary',
              header: say(compared.mergedColumn(secondary)),
              wrap: 'lines',
              cell: ({ secondary: shown }) => shown,
            },
            {
              key: 'merged',
              header: say(compared.merged),
              wrap: 'lines',
              cell: ({ merged }) => merged,
            },
          ]}
          rows={items}
          rowKey={({ term }) => term}
          emptyMessage={say(compared.empty)}
        />
      )}
      <p>{say(compared.whatMoves(primary, points))}</p>
      {obstacles.length > 0 ? (
        <Alert tone='warning' title={say(words.obstacles.title)}>
          <BulletList>
            {obstacles.map((obstacle) => {
              const text = say(obstacleTextOf(obstacle))
              return <li key={text}>{text}</li>
            })}
          </BulletList>
        </Alert>
      ) : (
        <Button variant='danger' onClick={onOpen}>
          {say(words.merge)}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={onClose}
        title={say(words.confirm)}
        description={say(
          words.confirmDescription(whoIs(pair.primary), whoIs(pair.secondary)),
        )}
        actions={
          <>
            <Button onClick={onClose}>{say(words.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onMerge}>
              {say(words.merge)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </div>
  )
}
