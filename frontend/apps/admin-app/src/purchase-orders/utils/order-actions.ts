import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsOrderStatusType,
  ModelsPurchaseOrderCancelRequest,
} from '@beauty-salon-frontend/api-client'
import { type FormRead, textOf, textOrNull } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { ChangeSays } from '../../bookings/utils/booking-actions'
import type { OrderStep } from '../api/purchase-orders-api'

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
): string | undefined =>
  match(status)
    .with(
      'delivered',
      () => 'この発注は納品済みです。ステータスは、もう変わりません。',
    )
    .with(
      'cancelled',
      () => 'この発注は取り消しました。ステータスは、もう変わりません。',
    )
    .with('pending', () =>
      approves
        ? undefined
        : '発注を承認し、取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
    )
    .with('draft', 'approved', 'ordered', 'shipped', () =>
      approves
        ? undefined
        : '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
    )
    .exhaustive()

const REASON_MISSING = '取り消す理由を入力してください。'

/** The cancellation of an order, from its form: the reason is asked for. */
export const readOrderCancellation = (
  values: FormData,
): FormRead<ModelsPurchaseOrderCancelRequest> => {
  const reason = textOrNull(textOf(values, 'cancellationReason'))

  return reason === null
    ? { type: 'invalid', errors: { cancellationReason: REASON_MISSING } }
    : { type: 'valid', value: { cancellationReason: reason } }
}

/** What an operation did, as the notification says it: 「発注 PO-… を承認」 */
const DONE: Record<OrderAction, (orderNumber: string) => string> = {
  submit: (orderNumber) => `発注 ${orderNumber} の承認を依頼`,
  approve: (orderNumber) => `発注 ${orderNumber} を承認`,
  order: (orderNumber) => `発注 ${orderNumber} を発注済みに`,
  ship: (orderNumber) => `発注 ${orderNumber} を出荷済みに`,
  cancel: (orderNumber) => `発注 ${orderNumber} を取り消`,
}

/** What could not be done, as a sentence says it */
const UNDONE: Record<OrderAction, string> = {
  submit: '承認を依頼できませんでした。',
  approve: '承認できませんでした。',
  order: '発注済みにできませんでした。',
  ship: '出荷済みにできませんでした。',
  cancel: '発注を取り消せませんでした。',
}

/** What is said when the order changed elsewhere in the meantime. */
export const ORDER_CHANGED_ELSEWHERE =
  '発注のステータスが、ほかの画面か端末で変わっていました。いまの発注を読み込み直しました。'

/** What follows an operation on the status of an order. */
export const afterOrderStep = (
  outcome: OrderStep,
  action: OrderAction,
  orderNumber: string,
): ChangeSays =>
  match(outcome)
    .returnType<ChangeSays>()
    .with({ type: 'changed' }, () => ({
      type: 'done',
      message: `${DONE[action](orderNumber)}しました。`,
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
      message: `${UNDONE[action]}通信の状態を確かめて、もう一度お試しください。`,
    }))
    .exhaustive()
