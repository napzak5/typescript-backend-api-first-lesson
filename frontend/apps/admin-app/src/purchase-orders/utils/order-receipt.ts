import {
  CHECK_THE_VALUES_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsOrderStatusType,
  ModelsPurchaseOrderItem,
  ModelsPurchaseOrderReceivedItem,
  ModelsPurchaseOrderReceiveRequest,
  ModelsPurchaseOrderResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { levelOf } from '../../products/utils/product-form'
import { hundredthsOf } from '../../products/utils/quantity'
import type { OrderReceipt } from '../api/purchase-orders-api'
import { itemQuantityNameOf, orderStatusNameOf } from './order-format'

/*
 * How the form of the goods that came for an order is read, and what it
 * says when the API did not take it. Every item whose stock row is still
 * there has a quantity, which starts as the quantity ordered: an item
 * left empty is not received.
 */

/** An item whose goods can be received: its stock row is still there */
export type ReceivableItem = Omit<ModelsPurchaseOrderItem, 'inventoryId'> & {
  inventoryId: string
}

/** The items of an order whose stock rows are still there, in the order of the order. */
export const receivableItemsOf = (
  items: readonly ModelsPurchaseOrderItem[],
): ReceivableItem[] =>
  items.flatMap(({ inventoryId, ...item }) =>
    inventoryId === null ? [] : [{ ...item, inventoryId }],
  )

/** The name of the control of the quantity that came of an item */
export const receivedControlOf = (inventoryId: string): string =>
  `received.${inventoryId}`

/** The quantity an item starts with on the form: all that was ordered */
export const orderedTextOf = ({
  quantity,
}: Pick<ModelsPurchaseOrderItem, 'quantity'>): string => `${quantity}`

const quantityErrorOf = (
  item: Pick<ModelsPurchaseOrderItem, 'quantity' | 'unit'>,
): string =>
  `届いた数量は、0 より大きく、発注した ${itemQuantityNameOf(item)} までの数（小数は 2 桁まで）で入力してください。`

const NONE_RECEIVED =
  '入荷する明細がありません。届いた明細に、数量を入力してください。'

const NOTES_KEPT =
  'いまの納品のメモは、入荷では消せません。そのまま残すか、書き換えてください。'

/** What an item of the form holds: nothing when it is not received */
type ReceivedRow =
  | { type: 'received'; item: ModelsPurchaseOrderReceivedItem }
  | { type: 'notReceived' }
  | { type: 'wrong'; errors: Record<string, string> }

const receivedRowOf = (values: FormData, item: ReceivableItem): ReceivedRow => {
  const control = receivedControlOf(item.inventoryId)
  const quantity = levelOf(textOf(values, control))
  if (quantity === null) {
    return { type: 'notReceived' }
  }

  return quantity === undefined ||
    quantity === 0 ||
    hundredthsOf(quantity) > hundredthsOf(item.quantity)
    ? { type: 'wrong', errors: { [control]: quantityErrorOf(item) } }
    : {
        type: 'received',
        item: { inventoryId: item.inventoryId, quantity },
      }
}
/**
 * The goods that came, from the form, with what the API checks of them:
 * at least one item, each more than none and no more than it ordered.
 * The notes of the delivery are sent when they were changed: the API
 * keeps them for null, so notes made empty are not sent but refused.
 */
export const readOrderReceipt = (
  values: FormData,
  order: Pick<ModelsPurchaseOrderResponse, 'items' | 'deliveryNotes'>,
): FormRead<ModelsPurchaseOrderReceiveRequest> => {
  const items = receivableItemsOf(order.items)
  const read = items.map((item) => receivedRowOf(values, item))
  const notes = textOrNull(textOf(values, 'deliveryNotes'))
  const kept = textOrNull(order.deliveryNotes)
  const errors = {
    ...Object.fromEntries(
      read.flatMap((row) =>
        row.type === 'wrong' ? Object.entries(row.errors) : [],
      ),
    ),
    ...(read.every((row) => row.type === 'notReceived')
      ? { [receivedControlOf(items[0]?.inventoryId ?? '')]: NONE_RECEIVED }
      : {}),
    ...(notes === null && kept !== null ? { deliveryNotes: NOTES_KEPT } : {}),
  }
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      items: read.flatMap((row) => (row.type === 'received' ? [row.item] : [])),
      deliveryNotes: notes === kept ? null : notes,
    },
  }
}

/** The statuses of an order whose goods are not received now */
type Unreceivable = Exclude<ModelsOrderStatusType, 'ordered' | 'shipped'>

const NOT_PLACED = (status: Unreceivable): string =>
  `この発注は${orderStatusNameOf(status)}です。入荷は、仕入先に頼んだ発注（発注済みか出荷済み）に記録します。`

/** What the screen of the receipt says of an order whose goods are not received now. */
export const UNRECEIVABLE: Record<Unreceivable, string> = {
  draft: NOT_PLACED('draft'),
  pending: NOT_PLACED('pending'),
  approved: NOT_PLACED('approved'),
  delivered: 'この発注は納品済みです。入荷は、記録してあります。',
  cancelled: 'この発注は取り消しました。取り消した発注は、入荷できません。',
}

/** What the screen says of an order none of whose items has its stock row any more */
export const NO_ROW_LEFT =
  '明細の在庫の行が、すべて削除されています。この発注は、入荷できません。'

/**
 * What the form says after the API did not take it. The order is read
 * anew after a row was removed or the order changed meanwhile: the form
 * then shows what can be received now, or the screen says why nothing
 * can.
 */
export const afterOrderReceipt = (
  outcome: Exclude<OrderReceipt, { type: 'received' | 'notFound' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    // The form sends what the API takes: a value it refused says nothing a
    // person could correct
    .with({ type: 'invalid' }, () => aboutTheAttempt(CHECK_THE_VALUES_MESSAGE))
    .with({ type: 'rowsChanged' }, () =>
      aboutTheAttempt(
        '明細の在庫の行のどれかが、その間に削除されました。発注を読み直しました。届いた数量を確かめて、もう一度記録してください。',
      ),
    )
    .with({ type: 'conflict' }, () =>
      aboutTheAttempt(
        '入荷を記録できませんでした。発注がその間に変わったか、入荷すると在庫数が 99,999,999.99 を超える行があります。発注を読み直しました。',
      ),
    )
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt('このアカウントでは、この発注の入荷を記録できません。'),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '入荷を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()
