import { type LocalizedText, text } from '../../languages/localized-text'
import { countOf } from '../written'
import {
  failedTo,
  ORDER_STATUSES,
  ORDER_WORDS,
  orderNamed,
} from './purchase-order-words'

/*
 * What the receipt of a purchase order says in the admin application: the
 * form of the goods that came, why the goods of an order are not received
 * now, and what is said of the answers. The codes and the names of the
 * products and their units stand as they were written.
 */

const { ordered, shipped } = ORDER_STATUSES

export const purchaseOrderReceiptMessages = {
  title: ORDER_WORDS.receive,
  submit: ORDER_WORDS.receive,
  received: text({ en: 'Quantities received', ja: '届いた数量' }),
  receivedDescription: text({
    en: 'Enter the quantity received of each line item. It starts as the quantity ordered. Leave a line item that did not arrive empty. Once the receipt is recorded, the order is delivered, and the empty line items are not received. What arrives later, and what arrives beyond the order, are recorded as stock movements (purchases).',
    ja: '届いた数量を、明細ごとに入力します。はじめの値は、発注した数量です。届かなかった明細は空にします。入荷を記録すると、発注は納品済みになり、空の明細は受け取りません。あとから届いた分と、発注より多く届いた分は、在庫の移動（仕入れ）で記録します。',
  }),
  /** What an item ordered, below the quantity that came: 「発注 10 tube」 */
  ordered: (quantity: LocalizedText) =>
    text({ en: `Ordered ${quantity.en}`, ja: `発注 ${quantity.ja}` }),
  /** An item whose stock row was removed: it is not received */
  rowRemoved: (productCode: string, productName: string) =>
    text({
      en: `${productCode} ${productName}: its stock row was removed, so it cannot be received.`,
      ja: `${productCode} ${productName}: 在庫の行が削除されたので、入荷できません。`,
    }),
  deliveryNotesDescription: text({
    en: 'Optional. What happened on arrival (such as missing or damaged goods). Changing it changes the delivery notes of the order.',
    ja: '任意。届いたときのこと（欠品や破損など）。書き換えると、発注の納品のメモが変わります。',
  }),
  /** The receipt was recorded, as the notification says it */
  done: (orderNumber: string, items: number) =>
    text({
      en: `Recorded the receipt of ${orderNamed(orderNumber).en}. Added the ${countOf(items, 'line item', 'line items', '件').en} that arrived to the stock.`,
      ja: `${orderNamed(orderNumber).ja} の入荷を記録しました。届いた ${countOf(items, 'line item', 'line items', '件').ja}の明細を、在庫に入れました。`,
    }),
  errors: {
    /** The quantity of an item is none, or more than it ordered */
    quantity: (most: LocalizedText) =>
      text({
        en: `Enter the quantity received as a number above 0 and up to the ${most.en} ordered (up to 2 decimal places).`,
        ja: `届いた数量は、0 より大きく、発注した ${most.ja} までの数（小数は 2 桁まで）で入力してください。`,
      }),
    noneReceived: text({
      en: 'No line item is received. Enter a quantity in the line items that arrived.',
      ja: '入荷する明細がありません。届いた明細に、数量を入力してください。',
    }),
    notesKept: text({
      en: 'The delivery notes cannot be cleared when the receipt is recorded. Keep them, or write others.',
      ja: 'いまの納品のメモは、入荷では消せません。そのまま残すか、書き換えてください。',
    }),
    rowsChanged: text({
      en: 'One of the stock rows of the line items was removed meanwhile. The order was loaded again. Check the quantities received and record them again.',
      ja: '明細の在庫の行のどれかが、その間に削除されました。発注を読み直しました。届いた数量を確かめて、もう一度記録してください。',
    }),
    conflict: text({
      en: 'Could not record the receipt. The order changed meanwhile, or the stock of a row would go above 99,999,999.99. The order was loaded again.',
      ja: '入荷を記録できませんでした。発注がその間に変わったか、入荷すると在庫数が 99,999,999.99 を超える行があります。発注を読み直しました。',
    }),
    forbidden: text({
      en: 'This account cannot record the receipt of this order.',
      ja: 'このアカウントでは、この発注の入荷を記録できません。',
    }),
    failed: failedTo(
      text({
        en: 'Could not record the receipt.',
        ja: '入荷を記録できませんでした。',
      }),
    ),
  },
  /** Why the goods of an order are not received now */
  unreceivable: {
    /** The order was not placed with the supplier yet: it is in a status before */
    notPlaced: (status: LocalizedText) =>
      text({
        en: `This order is “${status.en}”. A receipt is recorded for an order placed with the supplier (“${ordered.en}” or “${shipped.en}”).`,
        ja: `この発注は${status.ja}です。入荷は、仕入先に頼んだ発注（${ordered.ja}か${shipped.ja}）に記録します。`,
      }),
    delivered: text({
      en: 'This order was delivered. Its receipt is recorded.',
      ja: 'この発注は納品済みです。入荷は、記録してあります。',
    }),
    cancelled: text({
      en: 'This order was cancelled. No receipt is recorded for a cancelled order.',
      ja: 'この発注は取り消しました。取り消した発注は、入荷できません。',
    }),
    noRowLeft: text({
      en: 'The stock rows of all the line items were removed. No receipt can be recorded for this order.',
      ja: '明細の在庫の行が、すべて削除されています。この発注は、入荷できません。',
    }),
  },
}
