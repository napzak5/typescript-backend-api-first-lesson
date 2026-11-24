import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsOrderStatusType,
  ModelsPurchaseOrderCancelRequest,
  ModelsPurchaseOrderResponse,
} from '@beauty-salon-frontend/api-client'
import {
  type FormErrors,
  type FormRead,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { ChangeSays } from '../../bookings/utils/booking-actions'
import type { OrderStep } from '../api/purchase-orders-api'

const STATUS = adminPurchaseOrderMessages.status

/*
 * What can be done to the status of a purchase order, by whom, and what
 * the screen says after it. The update moves an order one status on;
 * approving and cancelling it are operations of their own, for the owner,
 * a manager and an administrator.
 */

/** An operation on the status of an order */
export type OrderAction = 'submit' | 'approve' | 'order' | 'ship' | 'cancel'

/** The operations the update carries out: each moves the order one status on */
export type OrderMove = Extract<OrderAction, 'submit' | 'order' | 'ship'>

/** The status each move takes an order to. */
export const MOVED_TO: Record<OrderMove, ModelsOrderStatusType> = {
  submit: 'pending',
  order: 'ordered',
  ship: 'shipped',
}

/** What an order of each status takes, in the order of the buttons */
const NEXT: Record<ModelsOrderStatusType, readonly OrderAction[]> = {
  draft: ['submit', 'cancel'],
  pending: ['approve', 'cancel'],
  approved: ['order', 'cancel'],
  ordered: ['ship', 'cancel'],
  shipped: ['cancel'],
  delivered: [],
  cancelled: [],
}

/** Whether an order was delivered or cancelled: nothing of it changes any more. */
export const isClosedOrder = (status: ModelsOrderStatusType): boolean =>
  NEXT[status].length === 0

/** The statuses of an order whose goods are received: placed with the supplier, or shipped by it */
const RECEIVABLE: readonly ModelsOrderStatusType[] = ['ordered', 'shipped']

/** Whether the goods of an order are received now: everybody who works at the salon records them. */
export const isReceivableOrder = (status: ModelsOrderStatusType): boolean =>
  RECEIVABLE.includes(status)

/** The roles that approve and cancel orders: approving one decides to spend the money */
const APPROVERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account of a role approves and cancels the orders of its salons. */
export const mayApproveOrders = (role: string): boolean =>
  APPROVERS.includes(role)

/** Whether an operation is one for the approvers alone */
const isForApprovers = (action: OrderAction): boolean =>
  action === 'approve' || action === 'cancel'

/** The operations an order of a status takes now, from an account that approves orders or not. */
export const orderActionsOf = (
  status: ModelsOrderStatusType,
  approves: boolean,
): readonly OrderAction[] =>
  NEXT[status].filter((action) => approves || !isForApprovers(action))

/**
 * What is said beside the buttons: that the order does not change any
 * more, or who does what the account may not. Nothing when every
 * operation of the status is offered.
 */
export const orderActionNoteOf = (
  status: ModelsOrderStatusType,
  approves: boolean,
): LocalizedText | undefined =>
  match(status)
    .with('delivered', () => STATUS.notes.delivered)
    .with('cancelled', () => STATUS.notes.cancelled)
    .with('pending', () =>
      approves ? undefined : STATUS.notes.approveAndCancel,
    )
    .with('draft', 'approved', 'ordered', 'shipped', () =>
      approves ? undefined : STATUS.notes.cancel,
    )
    .exhaustive()

/** The cancellation of an order, from its form: the reason is asked for. */
export const readOrderCancellation = (
  values: FormData,
): FormRead<ModelsPurchaseOrderCancelRequest, FormErrors<LocalizedText>> => {
  const reason = textOrNull(textOf(values, 'cancellationReason'))

  return reason === null
    ? {
        type: 'invalid',
        errors: { cancellationReason: STATUS.cancellation.reasonMissing },
      }
    : { type: 'valid', value: { cancellationReason: reason } }
}

/** What is said when the order changed elsewhere in the meantime. */
export const ORDER_CHANGED_ELSEWHERE = STATUS.changedElsewhere

/** What follows an operation on the status of an order. */
export const afterOrderStep = (
  outcome: OrderStep,
  action: OrderAction,
  orderNumber: string,
): ChangeSays<ModelsPurchaseOrderResponse> =>
  match(outcome)
    .returnType<ChangeSays<ModelsPurchaseOrderResponse>>()
    .with({ type: 'changed' }, ({ order }) => ({
      type: 'done',
      message: STATUS.done[action](orderNumber),
      now: order,
    }))
    .with({ type: 'conflict' }, () => ({
      type: 'changed',
      message: ORDER_CHANGED_ELSEWHERE,
    }))
    .with({ type: 'notFound' }, { type: 'forbidden' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: STATUS.failed[action],
    }))
    .exhaustive()
