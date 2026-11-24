import { type LocalizedText, text } from '../../languages/localized-text'
import { followed } from '../written'
import { purchaseOrderFormMessages } from './purchase-order-form'
import { purchaseOrderReceiptMessages } from './purchase-order-receipt'
import {
  failedTo,
  ORDER_STATUSES,
  ORDER_WORDS,
  orderNamed,
} from './purchase-order-words'

/*
 * What the screens of the purchase orders say in the admin application:
 * the orders of a salon and their filter, an order with its items and
 * what it comes to, the operations of its status, and the reorder
 * suggestions. The numbers of the orders, the suppliers, the names and
 * the codes of the products, the units, the terms of payment, the notes,
 * the reasons and the names of the staff stand as they were written.
 *
 * The other parts of the purchase orders are files of their own beside
 * this one, collected here under the same name: the forms of an order,
 * and the receipt of its goods.
 */

const TITLE = text({ en: 'Purchase orders', ja: '発注' })
const NO_SUPPLIER = text({
  en: 'Products without a supplier',
  ja: '仕入先の決まっていない商品',
})

/** Who approves and cancels orders, said after what the account may not do */
const approvers = (what: LocalizedText): LocalizedText =>
  text({
    en: `Only the owners and managers of the salon, and administrators, can ${what.en} orders.`,
    ja: `発注を${what.ja}のは、サロンのオーナーとマネージャーと、管理者です。`,
  })

export const adminPurchaseOrderMessages = {
  titles: {
    orders: TITLE,
    order: ORDER_WORDS.order,
    /** The screen of an order, by its number: 「発注 PO-…」 */
    numbered: (orderNumber: string) =>
      text({
        en: `Purchase order ${orderNumber}`,
        ja: `発注 ${orderNumber}`,
      }),
    entry: purchaseOrderFormMessages.entry.title,
    change: purchaseOrderFormMessages.change.title,
    receipt: purchaseOrderReceiptMessages.title,
    suggestions: ORDER_WORDS.suggestions,
  },
  /** What a screen could not read, and what a sentence names, as it stands there */
  names: {
    orders: text({ en: 'the purchase orders', ja: '発注' }),
    order: text({ en: 'the purchase order', ja: '発注' }),
    /** What a member of another salon cannot see of this one */
    ordersOfTheSalon: text({ en: 'purchase orders', ja: '発注' }),
    rows: text({ en: 'the stock rows', ja: '在庫の行' }),
    products: text({ en: 'the products', ja: '商品' }),
    suggestions: text({
      en: 'the reorder suggestions',
      ja: '発注の提案',
    }),
    /** What a member of another salon cannot see of this one */
    suggestionsOfTheSalon: text({
      en: 'reorder suggestions',
      ja: '発注の提案',
    }),
  },
  words: ORDER_WORDS,
  statuses: ORDER_STATUSES,
  orderNamed,
  /**
   * When something was done to an order, on the clock of the salon, and
   * who did it: 「2026年11月21日（土） 10:00（佐藤 健）」. The name of a
   * member of the staff stands as it was written.
   */
  doneBy: (moment: LocalizedText, who: string | LocalizedText) => {
    const name = typeof who === 'string' ? text({ en: who, ja: who }) : who

    return text({
      en: `${moment.en} (${name.en})`,
      ja: `${moment.ja}（${name.ja}）`,
    })
  },
  loading: {
    orders: text({
      en: 'Loading the purchase orders',
      ja: '発注を読み込んでいます',
    }),
    order: text({
      en: 'Loading the purchase order',
      ja: '発注を読み込んでいます',
    }),
    suggestions: text({
      en: 'Loading the reorder suggestions',
      ja: '発注の提案を読み込んでいます',
    }),
  },
  list: {
    matching: text({
      en: 'Matching purchase orders',
      ja: '条件に合う発注',
    }),
    noneMatching: text({
      en: 'No purchase orders match',
      ja: '条件に合う発注はありません',
    }),
    noneMatchingDescription: text({
      en: 'Change the filters and look again. A supplier is searched for by its name as the order spells it.',
      ja: '条件を変えて探してください。仕入先は、発注に書いたとおりの名前で探します。',
    }),
    none: text({ en: 'No purchase orders', ja: '発注はありません' }),
    noneDescription: text({
      en: `Create one with “${ORDER_WORDS.entry.en}”: write the quantity and the unit price of each stock row to order from the supplier.`,
      ja: `「${ORDER_WORDS.entry.ja}」から、仕入先に頼む商品を、在庫の行ごとに数量と単価を書いて作ります。`,
    }),
  },
  filter: {
    label: text({ en: 'Filter the purchase orders', ja: '発注を絞り込む' }),
    all: text({ en: 'All', ja: 'すべて' }),
    supplierDescription: text({
      en: 'The whole name of the supplier, as the order spells it.',
      ja: '仕入先の名前のすべて。発注に書いたとおりに入力します。',
    }),
    from: text({ en: 'Order date (from)', ja: '発注日（から）' }),
    to: text({ en: 'Order date (to)', ja: '発注日（まで）' }),
  },
  record: {
    orderedAt: text({ en: 'Ordered', ja: '発注日時' }),
    approved: text({ en: 'Approved', ja: '承認' }),
    deliveredAt: text({ en: 'Delivered', ja: '納品日時' }),
    cancelled: text({ en: 'Cancelled', ja: '取り消し' }),
    cancellationReason: text({
      en: 'Reason for the cancellation',
      ja: '取り消した理由',
    }),
    unitPrice: text({ en: 'Unit price', ja: '単価' }),
    amount: text({ en: 'Amount', ja: '金額' }),
    noItems: text({ en: 'No line items', ja: '明細はありません' }),
    amounts: text({ en: 'Amounts', ja: '金額' }),
    subtotal: text({ en: 'Subtotal', ja: '小計' }),
    tax: text({ en: 'Tax', ja: '税額' }),
    shipping: text({ en: 'Shipping', ja: '送料' }),
  },
  /** The status of an order, and what can be done to it */
  status: {
    title: text({ en: 'Status', ja: '状態' }),
    actions: {
      submit: text({ en: 'Ask for approval', ja: '承認を依頼する' }),
      approve: text({ en: 'Approve', ja: '承認する' }),
      order: text({ en: 'Mark as ordered', ja: '発注済みにする' }),
      ship: text({ en: 'Mark as shipped', ja: '出荷済みにする' }),
      cancel: text({ en: 'Cancel the order', ja: '発注を取り消す' }),
    },
    /** Why an operation is not offered: the order does not change any more, or the account may not */
    notes: {
      delivered: text({
        en: 'This order was delivered. Its status does not change any more.',
        ja: 'この発注は納品済みです。ステータスは、もう変わりません。',
      }),
      cancelled: text({
        en: 'This order was cancelled. Its status does not change any more.',
        ja: 'この発注は取り消しました。ステータスは、もう変わりません。',
      }),
      approveAndCancel: approvers(
        text({ en: 'approve and cancel', ja: '承認し、取り消せる' }),
      ),
      cancel: approvers(text({ en: 'cancel', ja: '取り消せる' })),
    },
    /** What an operation did, as the notification says it */
    done: {
      submit: (orderNumber: string) =>
        text({
          en: `Asked for the approval of ${orderNamed(orderNumber).en}.`,
          ja: `${orderNamed(orderNumber).ja} の承認を依頼しました。`,
        }),
      approve: (orderNumber: string) =>
        text({
          en: `Approved ${orderNamed(orderNumber).en}.`,
          ja: `${orderNamed(orderNumber).ja} を承認しました。`,
        }),
      order: (orderNumber: string) =>
        text({
          en: `Marked ${orderNamed(orderNumber).en} as ordered.`,
          ja: `${orderNamed(orderNumber).ja} を発注済みにしました。`,
        }),
      ship: (orderNumber: string) =>
        text({
          en: `Marked ${orderNamed(orderNumber).en} as shipped.`,
          ja: `${orderNamed(orderNumber).ja} を出荷済みにしました。`,
        }),
      cancel: (orderNumber: string) =>
        text({
          en: `Cancelled ${orderNamed(orderNumber).en}.`,
          ja: `${orderNamed(orderNumber).ja} を取り消しました。`,
        }),
    },
    /** What could not be done */
    failed: {
      submit: failedTo(
        text({
          en: 'Could not ask for the approval.',
          ja: '承認を依頼できませんでした。',
        }),
      ),
      approve: failedTo(
        text({
          en: 'Could not approve the order.',
          ja: '承認できませんでした。',
        }),
      ),
      order: failedTo(
        text({
          en: 'Could not mark the order as ordered.',
          ja: '発注済みにできませんでした。',
        }),
      ),
      ship: failedTo(
        text({
          en: 'Could not mark the order as shipped.',
          ja: '出荷済みにできませんでした。',
        }),
      ),
      cancel: failedTo(
        text({
          en: 'Could not cancel the order.',
          ja: '発注を取り消せませんでした。',
        }),
      ),
    },
    changedElsewhere: text({
      en: 'The status of the order was changed on another screen or device. The order was loaded again as it is now.',
      ja: '発注のステータスが、ほかの画面か端末で変わっていました。いまの発注を読み込み直しました。',
    }),
    /** The dialog that asks for the reason of a cancellation */
    cancellation: {
      title: text({
        en: 'Cancel the order?',
        ja: '発注を取り消しますか？',
      }),
      /** What a cancellation does, and what to do first of an order that was shipped */
      description: (orderNumber: string, shipped: boolean) =>
        followed(
          text({
            en: `Order ${orderNumber} will be cancelled.`,
            ja: `${orderNamed(orderNumber).ja} を取り消します。`,
          }),
          ...(shipped
            ? [
                text({
                  en: 'The order was shipped: agree with the supplier on the return of the goods before cancelling it.',
                  ja: '出荷済みの発注です。返品の扱いを仕入先と決めてから取り消してください。',
                }),
              ]
            : []),
          text({
            en: 'A cancelled order cannot be restored.',
            ja: '取り消した発注は、元に戻せません。',
          }),
        ),
      submit: text({ en: 'Cancel the order', ja: '取り消す' }),
      reason: text({
        en: 'Reason for the cancellation',
        ja: '取り消す理由',
      }),
      reasonDescription: text({
        en: 'Such as the supplier being out of stock. The reason stays in the order details.',
        ja: '仕入先の在庫切れなど。理由は、発注の内容に残ります。',
      }),
      reasonMissing: text({
        en: 'Enter the reason for the cancellation.',
        ja: '取り消す理由を入力してください。',
      }),
    },
  },
  /** The products a salon had better order, by supplier */
  suggestions: {
    description: text({
      en: 'Products whose stock and quantity on order together came down to their reorder point or below. The suggested quantity brings them up to their maximum stock, or to their reorder point when they have none. The quantity on order counts the drafts and the orders awaiting approval too.',
      ja: '在庫と発注中の数の和が、発注点以下になった商品です。提案する数量は、最大在庫数（ない商品は発注点）まで補う数です。発注中の数には、下書きと承認待ちの発注も入ります。',
    }),
    none: text({
      en: 'No reorder suggestions',
      ja: '発注の提案はありません',
    }),
    noneDescription: text({
      en: 'No product’s stock and quantity on order together came down to its reorder point.',
      ja: '在庫と発注中の数の和が、発注点以下になった商品はありません。',
    }),
    noSupplier: NO_SUPPLIER,
    /** The products of a supplier, as the caption of their table names them */
    of: (supplier: string) =>
      text({
        en: `Suggestions for ${supplier}`,
        ja: `${supplier}の提案`,
      }),
    /** The products that name no supplier, as the caption of their table names them */
    ofNoSupplier: text({
      en: 'Suggestions for the products without a supplier',
      ja: '仕入先の決まっていない商品の提案',
    }),
    /** A new order that starts with the suggestions of a supplier */
    entryOf: (supplier: string) =>
      text({
        en: `Create an order to ${supplier}`,
        ja: `${supplier} への発注を作る`,
      }),
    entryWithoutSupplier: text({
      en: 'Choose a supplier and create an order',
      ja: '仕入先を決めて発注を作る',
    }),
    inStock: text({ en: 'In stock', ja: '在庫' }),
    onOrder: text({ en: 'On order', ja: '発注中' }),
    reorderPoint: text({ en: 'Reorder point', ja: '発注点' }),
    maximum: text({ en: 'Maximum stock', ja: '最大在庫数' }),
    noMaximum: text({ en: 'Not set', ja: '設定なし' }),
    suggested: text({ en: 'Suggested quantity', ja: '提案する数量' }),
    lastOrdered: text({ en: 'Last ordered', ja: '最後の発注日' }),
    noneOfThem: text({ en: 'No suggestions', ja: '提案はありません' }),
  },
  /** A screen of an order when there is none to show: none at the address, or one of another salon */
  notFound: {
    title: text({
      en: 'Purchase order not found',
      ja: '発注が見つかりません',
    }),
    description: text({
      en: 'Check that the address is right.',
      ja: 'アドレスが正しいか、お確かめください。',
    }),
  },
  form: purchaseOrderFormMessages,
  receipt: purchaseOrderReceiptMessages,
}
