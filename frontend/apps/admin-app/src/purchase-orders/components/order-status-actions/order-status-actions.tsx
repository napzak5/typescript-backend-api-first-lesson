import type { ModelsPurchaseOrderResponse } from '@beauty-salon-frontend/api-client'
import {
  Actions,
  Badge,
  Button,
  ButtonLink,
  Card,
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  Note,
  TextArea,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import type { OrderAction } from '../../utils/order-actions'
import { orderStatusNameOf, orderStatusToneOf } from '../../utils/order-format'
import styles from './order-status-actions.module.css'

const { status: WORDS, words } = adminPurchaseOrderMessages

/** The operations that are done at once: every one but the cancellation */
export type OrderMoveAction = Exclude<OrderAction, 'cancel'>

export type OrderStatusActionsProps = {
  order: Pick<ModelsPurchaseOrderResponse, 'status' | 'orderNumber'>
  /** The operations the order takes now from the account, in the order of their buttons */
  actions: readonly OrderAction[]
  /** Why an operation is not offered: the order does not change any more, or the account may not */
  note?: LocalizedText | undefined
  /** The screen that records the goods that came, for an order whose goods are received now */
  receiveHref?: string | undefined
  /** The heading of the part: the focus goes there after an operation */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The operation that is on its way */
  pending?: OrderAction | undefined
  /** Whether the dialog of the cancellation is open */
  asking?: boolean | undefined
  /** What went wrong with the cancellation in the dialog */
  message?: LocalizedText | undefined
  /** What is wrong with the reason of the cancellation */
  cancellationErrors?: FormErrors<LocalizedText> | undefined
  onAct: (action: OrderMoveAction) => void
  /** The button of the cancellation was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onCancel: (values: FormData) => void
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
  cancellationErrors = NO_ERRORS,
  onAct,
  onAsk,
  onClose,
  onCancel,
}: OrderStatusActionsProps) => {
  const say = useSay()
  const cancellation = useSaidForm(message, cancellationErrors)

  return (
    <Card title={say(WORDS.title)} headingRef={headingRef}>
      <div className={styles['statusActions']}>
        <p>
          <Badge tone={orderStatusToneOf(order.status)}>
            {say(orderStatusNameOf(order.status))}
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
                    {say(WORDS.actions[action])}
                  </Button>
                ),
            )}
            {receiveHref !== undefined && (
              <ButtonLink href={receiveHref} variant='primary'>
                {say(words.receive)}
              </ButtonLink>
            )}
            {actions.includes('cancel') && (
              <Button variant='danger' onClick={onAsk}>
                {say(WORDS.actions.cancel)}
              </Button>
            )}
          </Actions>
        )}
        {note !== undefined && <Note>{say(note)}</Note>}
      </div>
      <FormDialog
        open={asking}
        onClose={onClose}
        title={say(WORDS.cancellation.title)}
        description={say(
          WORDS.cancellation.description(
            order.orderNumber,
            order.status === 'shipped',
          ),
        )}
        submitLabel={say(WORDS.cancellation.submit)}
        submitVariant='danger'
        message={cancellation.message}
        errors={cancellationErrors}
        pending={pending === 'cancel'}
        onSubmit={onCancel}
      >
        <TextArea
          label={say(WORDS.cancellation.reason)}
          name='cancellationReason'
          rows={4}
          required
          description={say(WORDS.cancellation.reasonDescription)}
          error={cancellation.errors['cancellationReason']}
        />
      </FormDialog>
    </Card>
  )
}
