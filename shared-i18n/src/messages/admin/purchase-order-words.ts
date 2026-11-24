import { type LocalizedText, text } from '../../languages/localized-text'
import { followed } from '../written'

/*
 * What the catalogues of the purchase orders share: the names of the
 * statuses, how an order is named in a sentence, and the words of its
 * fields. The numbers of the orders, the suppliers, the names and the codes
 * of the products, the units and the notes stand as they were written.
 * Each part of the purchase orders is a file of its own, and
 * `adminPurchaseOrderMessages` (`purchase-orders.ts`) collects them under
 * one name.
 */

/** The statuses of an order, in the words of the contract */
export const ORDER_STATUSES = {
  draft: text({ en: 'Draft', ja: '下書き' }),
  pending: text({ en: 'Awaiting approval', ja: '承認待ち' }),
  approved: text({ en: 'Approved', ja: '承認済み' }),
  ordered: text({ en: 'Ordered', ja: '発注済み' }),
  shipped: text({ en: 'Shipped', ja: '出荷済み' }),
  delivered: text({ en: 'Delivered', ja: '納品済み' }),
  cancelled: text({ en: 'Cancelled', ja: '取り消し' }),
}

/** An order by its number, as a sentence names it: 「発注 PO-20261121-0001」 */
export const orderNamed = (orderNumber: string): LocalizedText =>
  text({ en: `order ${orderNumber}`, ja: `発注 ${orderNumber}` })

/** What follows a sentence that says an attempt came to nothing */
const TRY_AGAIN = text({
  en: 'Check your connection and try again.',
  ja: '通信の状態を確かめて、もう一度お試しください。',
})

/** That an attempt came to nothing, and what to do about it */
export const failedTo = (what: LocalizedText): LocalizedText =>
  followed(what, TRY_AGAIN)

/** The words of the purchase orders that more than one of their parts says */
export const ORDER_WORDS = {
  order: text({ en: 'Purchase order', ja: '発注' }),
  orderNumber: text({ en: 'Order number', ja: '発注番号' }),
  status: text({ en: 'Status', ja: 'ステータス' }),
  supplier: text({ en: 'Supplier', ja: '仕入先' }),
  orderDate: text({ en: 'Order date', ja: '発注日' }),
  expectedDelivery: text({ en: 'Expected delivery', ja: '納品予定日' }),
  paymentTerms: text({ en: 'Payment terms', ja: '支払条件' }),
  notes: text({ en: 'Notes', ja: 'メモ' }),
  deliveryNotes: text({ en: 'Delivery notes', ja: '納品のメモ' }),
  items: text({ en: 'Line items', ja: '明細' }),
  productCode: text({ en: 'Product code', ja: '商品コード' }),
  productName: text({ en: 'Product name', ja: '商品名' }),
  quantity: text({ en: 'Quantity', ja: '数量' }),
  total: text({ en: 'Total', ja: '合計' }),
  /** What is said of a delivery nobody set a day for */
  notSet: text({ en: 'Not set', ja: '未定' }),
  /** The way back to the orders of the salon */
  toOrders: text({ en: 'Back to the purchase orders', ja: '発注へ' }),
  /** The way back to an order */
  toOrder: text({ en: 'Back to the order', ja: '発注へ戻る' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  /** The screen that records the goods that came */
  receive: text({ en: 'Record the receipt', ja: '入荷を記録する' }),
  entry: text({ en: 'Create a purchase order', ja: '発注を作る' }),
  suggestions: text({ en: 'Reorder suggestions', ja: '発注の提案' }),
  /** What the notes of an order hold, as their control says it */
  notesDescription: text({
    en: 'Optional. Such as what to tell the supplier, or what to do once the goods arrive.',
    ja: '任意。仕入先への連絡や、届いたあとのことなど。',
  }),
  /** The day the supplier promised, as its control says it */
  deliveryDescription: text({
    en: 'Optional. The day the supplier promised.',
    ja: '任意。仕入先が約束した日。',
  }),
  dayMissing: text({ en: 'Enter a date.', ja: '日付を入力してください。' }),
  /** An order and its supplier, above a form of it: 「発注 PO-…（Beauty Supply Co.）」 */
  orderOf: (orderNumber: string, supplier: string) =>
    text({
      en: `Order ${orderNumber} (${supplier})`,
      ja: `発注 ${orderNumber}（${supplier}）`,
    }),
}
