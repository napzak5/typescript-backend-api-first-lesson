import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { followed } from '../written'
import { rowsOf } from './inventory-words'
import { failedTo, ORDER_WORDS, orderNamed } from './purchase-order-words'

/*
 * What the forms of a purchase order say in the admin application: the
 * form of a new order, with a quantity and a unit price for every stock
 * row and what the items come to, the suggestions it may start with, and
 * the form that changes the day of the delivery and the notes of an order.
 */

export const purchaseOrderFormMessages = {
  entry: {
    title: ORDER_WORDS.entry,
    submit: ORDER_WORDS.entry,
    supplierDescription: text({
      en: 'Orders are also searched for by this name.',
      ja: '発注を探すときも、この名前で探します。',
    }),
    itemsDescription: text({
      en: 'Enter a quantity in the rows to order. Rows left empty are not ordered. The unit price starts as the purchase price of the product. Quantities take up to 2 decimal places.',
      ja: '発注する行に、数量を入力します。空のままの行は発注しません。単価のはじめの値は、商品の仕入価格です。数量の小数は 2 桁まで。',
    }),
    /** How many of a row there are, below its quantity: 「在庫数 12 bottle」 */
    inStock: (quantity: LocalizedText) =>
      text({ en: `In stock: ${quantity.en}`, ja: `在庫数 ${quantity.ja}` }),
    unitPrice: text({ en: 'Unit price (yen)', ja: '単価（円）' }),
    /** What the items come to, worked out as they are entered: 「小計 ￥5,500」 */
    subtotal: (amount: LocalizedText) =>
      text({ en: `Subtotal ${amount.en}`, ja: `小計 ${amount.ja}` }),
    tax: text({ en: 'Tax (yen)', ja: '税額（円）' }),
    /** The tax the rate of the salon makes of the subtotal: 「小計の 10% は ￥550 です」 */
    taxDescription: (rate: LocalizedText, amount: LocalizedText) =>
      text({
        en: `Enter it as the bill of the supplier says. ${rate.en} of the subtotal is ${amount.en} (rounded down to the yen).`,
        ja: `仕入先の請求に合わせて入力します。小計の ${rate.ja} は ${amount.ja} です（円未満切り捨て）。`,
      }),
    shipping: text({ en: 'Shipping (yen)', ja: '送料（円）' }),
    shippingDescription: text({
      en: 'Optional. Leave it empty when there is no shipping cost.',
      ja: '任意。送料がかからなければ空のままにします。',
    }),
    paymentTermsDescription: text({
      en: 'Optional. Such as payment at the end of the month after the bill.',
      ja: '任意。月末締め翌月末払い、など。',
    }),
    /** What a new order that starts with the suggestions of a supplier says above its form */
    suggested: {
      none: text({
        en: 'There are no reorder suggestions of this supplier now. Enter a quantity in the rows to order.',
        ja: 'この仕入先の発注の提案は、いまはありません。発注する行に、数量を入力してください。',
      }),
      /** The quantities of the products that name no supplier, in how many rows */
      noSupplier: (filled: number) =>
        text({
          en: `Filled in the suggested quantities of the products without a supplier in ${rowsOf(filled).en}. Enter the supplier, and check the quantities and the unit prices.`,
          ja: `仕入先の決まっていない商品の、発注の提案の数量を ${rowsOf(filled).ja}に入れました。仕入先を入力し、数量と単価を確かめてください。`,
        }),
      /** The quantities of a supplier, in how many rows */
      of: (supplier: string, filled: number) =>
        text({
          en: `Filled in the suggested quantities of ${supplier} in ${rowsOf(filled).en}. Check the quantities and the unit prices.`,
          ja: `${supplier} の発注の提案の数量を ${rowsOf(filled).ja}に入れました。数量と単価を確かめてください。`,
        }),
    },
    loadingRows: text({
      en: 'Loading the stock rows',
      ja: '在庫の行を読み込んでいます',
    }),
    noRows: {
      title: text({
        en: 'No stock rows to order',
        ja: '発注する在庫の行がありません',
      }),
      description: text({
        en: 'Orders are made by stock row. The owners and managers of the salon, and administrators, add stock rows.',
        ja: '発注は、在庫の行ごとに作ります。在庫の行は、サロンのオーナーとマネージャーと、管理者が足します。',
      }),
      toInventory: text({ en: 'Go to the inventory', ja: '在庫へ' }),
    },
    /** The order was made, as the notification says it */
    made: (orderNumber: string, status: LocalizedText) =>
      text({
        en: `Created ${orderNamed(orderNumber).en} with the status “${status.en}”.`,
        ja: `${orderNamed(orderNumber).ja} を${status.ja}として作りました。`,
      }),
    errors: {
      supplierMissing: text({
        en: 'Enter the supplier.',
        ja: '仕入先を入力してください。',
      }),
      quantity: text({
        en: 'Enter the quantity as a number above 0 and up to 99,999,999.99 (up to 2 decimal places).',
        ja: '数量は、0 より大きく 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
      }),
      unitPrice: text({
        en: 'Enter the unit price as a whole number of yen from 0.',
        ja: '単価は、0 以上の円の整数で入力してください。',
      }),
      /** The unit price at which an item of the quantity comes to more than an amount holds */
      unitPriceTooHigh: (largest: LocalizedText, most: LocalizedText) =>
        text({
          en: `At this quantity, the unit price can be up to ${largest.en}. The amount of a line item can be up to ${most.en}.`,
          ja: `この数量では、単価は ${largest.ja}までです。明細の金額は ${most.ja}までです。`,
        }),
      noneOrdered: text({
        en: 'No row is ordered. Enter a quantity in the rows to order.',
        ja: '発注する行がありません。発注する行に、数量を入力してください。',
      }),
      /** More items than one order holds */
      tooMany: (most: number) =>
        text({
          en: `One order takes up to ${numberOf(most).en} rows. Put the other rows in another order.`,
          ja: `1 件の発注に入れられるのは ${numberOf(most).ja} 行までです。残りの行は、別の発注にしてください。`,
        }),
      taxMissing: text({
        en: 'Enter the tax. Enter 0 when there is none.',
        ja: '税額を入力してください。税がかからなければ 0 にします。',
      }),
      tax: text({
        en: 'Enter the tax as a whole number of yen from 0.',
        ja: '税額は、0 以上の円の整数で入力してください。',
      }),
      shipping: text({
        en: 'Enter the shipping cost as a whole number of yen from 0.',
        ja: '送料は、0 以上の円の整数で入力してください。',
      }),
      /** Amounts larger than one order holds */
      tooMuch: (most: LocalizedText) =>
        text({
          en: `The total would be more than ${most.en}. Split the line items into two or more orders.`,
          ja: `合計が ${most.ja} を超えます。明細を分けて、発注を 2 件以上にしてください。`,
        }),
      rowsChanged: text({
        en: 'One of the stock rows to order was removed meanwhile. The stock rows were loaded again. Check the quantities and create the order again.',
        ja: '発注する在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数量を確かめて、もう一度作ってください。',
      }),
      forbidden: text({
        en: 'This account cannot create purchase orders of this salon.',
        ja: 'このアカウントでは、このサロンの発注を作れません。',
      }),
      failed: failedTo(
        text({
          en: 'Could not create the purchase order.',
          ja: '発注を作れませんでした。',
        }),
      ),
    },
  },
  change: {
    title: text({ en: 'Edit the purchase order', ja: '発注を直す' }),
    /** The button of the screen of an order that leads here */
    open: text({
      en: 'Edit the delivery date and the notes',
      ja: '納品予定日とメモを直す',
    }),
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    deliveryDescription: followed(
      ORDER_WORDS.deliveryDescription,
      text({
        en: 'Leave it empty when no day is set.',
        ja: '空にすると、未定になります。',
      }),
    ),
    deliveryNotesDescription: text({
      en: 'Optional. What was agreed with the supplier about the delivery, such as where and when it arrives.',
      ja: '任意。届け先や届く時間など、納品について仕入先と決めたこと。',
    }),
    /** What the screen says of an order that was delivered or cancelled: the API does not change it any more */
    closed: {
      delivered: text({
        en: 'This order was delivered. A delivered order cannot be edited.',
        ja: 'この発注は納品済みです。納品済みの発注は、直せません。',
      }),
      cancelled: text({
        en: 'This order was cancelled. A cancelled order cannot be edited.',
        ja: 'この発注は取り消しました。取り消した発注は、直せません。',
      }),
    },
    changed: (orderNumber: string) =>
      text({
        en: `Saved ${orderNamed(orderNumber).en}.`,
        ja: `${orderNamed(orderNumber).ja} を直しました。`,
      }),
    forbidden: text({
      en: 'This account cannot edit this order.',
      ja: 'このアカウントでは、この発注を直せません。',
    }),
    failed: failedTo(
      text({
        en: 'Could not save the purchase order.',
        ja: '発注を直せませんでした。',
      }),
    ),
  },
}
