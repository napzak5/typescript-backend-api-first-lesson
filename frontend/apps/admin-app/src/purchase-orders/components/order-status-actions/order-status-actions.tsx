import type { ModelsPurchaseOrderResponse } from '@beauty-salon-frontend/api-client'
import {
  Actions,
  Badge,
  Button,
  ButtonLink,
  Card,
  FormDialog,
  Note,
  TextArea,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import type { OrderAction } from '../../order-actions'
import { orderStatusNameOf, orderStatusToneOf } from '../../order-format'
import styles from './order-status-actions.module.css'

/** The operations that are done at once: every one but the cancellation */
export type OrderMoveAction = Exclude<OrderAction, 'cancel'>

export type OrderStatusActionsProps = {
  order: Pick<ModelsPurchaseOrderResponse, 'status' | 'orderNumber'>
  /** The operations the order takes now from the account, in the order of their buttons */
  actions: readonly OrderAction[]
  /** Why an operation is not offered: the order does not change any more, or the account may not */
  note?: string | undefined
  /** The screen that records the goods that came, for an order whose goods are received now */
  receiveHref?: string | undefined
  /** The heading of the part: the focus goes there after an operation */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The operation that is on its way */
  pending?: OrderAction | undefined
  /** Whether the dialog of the cancellation is open */
  asking?: boolean | undefined
  /** What went wrong with the cancellation in the dialog */
  message?: string | undefined
  /** What is wrong with the reason of the cancellation */
  cancellationErrors?: Record<string, string> | undefined
  onAct: (action: OrderMoveAction) => void
  /** The button of the cancellation was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onCancel: (values: FormData) => void
}

const LABELS: Record<OrderAction, string> = {
  submit: '承認を依頼する',
  approve: '承認する',
  order: '発注済みにする',
  ship: '出荷済みにする',
  cancel: '発注を取り消す',
}

/**
 * The status of a purchase order, and what can be done to it. Moving it
 * on is done at once; the goods that came are recorded on a screen of
 * their own; a cancellation cannot be undone, so a dialog asks for its
 * reason first.
 */
export const OrderStatusActions = ({
  order,
  actions,
  note,
  receiveHref,
  headingRef,
  pending,
  asking = false,
  message,
  cancellationErrors = {},
  onAct,
  onAsk,
  onClose,
  onCancel,
}: OrderStatusActionsProps) => {
  return (
    <Card title='状態' headingRef={headingRef}>
      <div className={styles['statusActions']}>
        <p>
          <Badge tone={orderStatusToneOf(order.status)}>
            {orderStatusNameOf(order.status)}
          </Badge>
        </p>
        {(actions.length > 0 || receiveHref !== undefined) && (
          <Actions>
            {actions.map(
              (action) =>
                action !== 'cancel' && (
                  <Button
                    key={action}
                    variant='primary'
                    pending={pending === action}
                    onClick={() => onAct(action)}
                  >
                    {LABELS[action]}
                  </Button>
                ),
            )}
            {receiveHref !== undefined && (
              <ButtonLink href={receiveHref} variant='primary'>
                入荷を記録する
              </ButtonLink>
            )}
            {actions.includes('cancel') && (
              <Button variant='danger' onClick={onAsk}>
                {LABELS.cancel}
              </Button>
            )}
          </Actions>
        )}
        {note !== undefined && <Note>{note}</Note>}
      </div>
      <FormDialog
        open={asking}
        onClose={onClose}
        title='発注を取り消しますか？'
        description={`発注 ${order.orderNumber} を取り消します。${
          order.status === 'shipped'
            ? '出荷済みの発注です。返品の扱いを仕入先と決めてから取り消してください。'
            : ''
        }取り消した発注は、元に戻せません。`}
        submitLabel='取り消す'
        submitVariant='danger'
        message={message}
        errors={cancellationErrors}
        pending={pending === 'cancel'}
        onSubmit={onCancel}
      >
        <TextArea
          label='取り消す理由'
          name='cancellationReason'
          rows={4}
          required
          description='仕入先の在庫切れなど。理由は、発注の内容に残ります。'
          error={cancellationErrors['cancellationReason']}
        />
      </FormDialog>
    </Card>
  )
}
