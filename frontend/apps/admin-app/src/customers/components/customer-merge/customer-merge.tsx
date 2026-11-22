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
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { customerNameOf } from '../../api/customers-api'
import { countNameOf } from '../../utils/customer-format'
import {
  MERGE_WAYS,
  type MergeObstacle,
  type MergeWay,
  mergedLedgerOf,
  mergeWayIn,
  mergeWayNameOf,
  obstacleTextOf,
  whoIs,
} from '../../utils/customer-merge'
import {
  comparedItemsOf,
  type LedgerValues,
} from '../customer-record/ledger-items'
import styles from './customer-merge.module.css'

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
  /** Why the last attempt was refused, and the two were read again: said above the choices */
  refusal?: string | undefined
  /** The dialog that asks before the two are merged is open */
  open: boolean
  /** The button that merges was pressed: the dialog is to be opened */
  onOpen: () => void
  /** The dialog has closed, or its button that changes nothing was pressed. Set `open` to false here */
  onClose: () => void
  /** What went wrong with the attempt, and may be tried again: said in the dialog */
  message?: string | undefined
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
  const pair = thisKept
    ? { primary: customer, secondary: other }
    : { primary: other, secondary: customer }
  const primary = customerNameOf(pair.primary)
  const secondary = customerNameOf(pair.secondary)
  const referrerOf = ({ referredBy }: LedgerValues): ReactNode =>
    referredBy === null ? null : (
      <Link href={customerHref(referredBy)}>紹介したお客様</Link>
    )
  const items = comparedItemsOf(
    pair.primary,
    pair.secondary,
    mergedLedgerOf(pair, way),
    referrerOf,
  )
  const points = pair.primary.loyaltyPoints + pair.secondary.loyaltyPoints

  return (
    <div className={styles['merge']}>
      {refusal !== undefined && <Alert tone='danger'>{refusal}</Alert>}
      <FieldRow>
        <RadioGroup
          label='残すお客様'
          name='kept'
          options={[
            { value: 'this', label: `このお客様: ${whoIs(customer)}` },
            { value: 'other', label: `選んだお客様: ${whoIs(other)}` },
          ]}
          value={thisKept ? 'this' : 'other'}
          onChange={(event) => onKeep(event.currentTarget.value === 'this')}
          description='残さないお客様は、台帳から削除されます。'
        />
        <RadioGroup
          label='2 人の値が違う項目'
          name='way'
          options={MERGE_WAYS.map((value) => ({
            value,
            label: mergeWayNameOf(value),
          }))}
          value={way}
          onChange={(event) => {
            const chosen = mergeWayIn(event.currentTarget.value)
            if (chosen !== undefined) {
              onWay(chosen)
            }
          }}
          description='片方だけが値を持つ項目は、その値を残します。'
        />
      </FieldRow>
      {items.length === 0 ? (
        <p>2 人の台帳の項目は、すべて同じです。</p>
      ) : (
        <Table
          caption='2 人で違う項目'
          columns={[
            { key: 'term', header: '項目', cell: ({ term }) => term },
            {
              key: 'primary',
              header: `残す ${primary} 様`,
              wrap: 'lines',
              cell: ({ primary: shown }) => shown,
            },
            {
              key: 'secondary',
              header: `まとめる ${secondary} 様`,
              wrap: 'lines',
              cell: ({ secondary: shown }) => shown,
            },
            {
              key: 'merged',
              header: 'まとめたあと',
              wrap: 'lines',
              cell: ({ merged }) => merged,
            },
          ]}
          rows={items}
          rowKey={({ term }) => term}
          emptyMessage='違う項目はありません'
        />
      )}
      <p>
        {`予約、売上、施術記録、レビューは、${primary} 様のものになります。好み設定、カルテ、アレルギーは、2 人のものを合わせます。ポイントは、2 人の残高を合わせて ${countNameOf(points, 'ポイント')}になります。`}
      </p>
      {obstacles.length > 0 ? (
        <Alert tone='warning' title='まとめられません'>
          <BulletList>
            {obstacles.map((obstacle) => {
              const text = obstacleTextOf(obstacle)
              return <li key={text}>{text}</li>
            })}
          </BulletList>
        </Alert>
      ) : (
        <Button variant='danger' onClick={onOpen}>
          まとめる
        </Button>
      )}
      <Dialog
        open={open}
        onClose={onClose}
        title='2 人のお客様を 1 人にまとめますか？'
        description={`${whoIs(pair.primary)}を残し、${whoIs(pair.secondary)}を台帳から削除します。削除したお客様は、台帳に戻せません。`}
        actions={
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button variant='danger' pending={pending} onClick={onMerge}>
              まとめる
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    </div>
  )
}
