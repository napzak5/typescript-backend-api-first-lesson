import { type LocalizedText, text } from '../../languages/localized-text'

/*
 * What the catalogues of the sales share: the words of what a sale and a
 * payment record, of what a sale comes to, and of the ways on, who may
 * undo a sale, and how a sale is named. The numbers of the sales and of
 * the payments, the names of the payment methods and of the items, the
 * notes and the reasons stand as they were written. Each part of the sales
 * is a file of its own, and `adminSaleMessages` (`sales.ts`) collects them
 * under one name.
 */

/** What a member of the staff is told where a sale would be voided or a payment given back */
export const UNDONE_BY_OTHERS = text({
  en: 'Owners and managers void sales and record refunds.',
  ja: '売上の取り消しと返金は、オーナーとマネージャーができます。',
})

/** A sale by its number, as a sentence names it: 「売上番号 SL-2KQM-9F4H」 */
export const saleNamed = (saleNumber: string): LocalizedText =>
  text({ en: `Sale ${saleNumber}`, ja: `売上番号 ${saleNumber}` })

/** The words of the sales that more than one of their parts says */
export const SALE_WORDS = {
  saleNumber: text({ en: 'Sale number', ja: '売上番号' }),
  saleTime: text({ en: 'Time of sale', ja: '会計日時' }),
  saleDate: text({ en: 'Date of sale', ja: '会計日' }),
  cashier: text({ en: 'Cashier', ja: '会計の担当' }),
  /** Nobody is recorded as the member who took the payment */
  noCashier: text({ en: 'Not recorded', ja: '記録しない' }),
  notes: text({ en: 'Notes', ja: 'メモ' }),
  notesDescription: text({
    en: 'A note on this sale for the salon. Customers do not see it.',
    ja: 'サロンの中で見る、この会計のメモです。お客様には見えません。',
  }),
  /** How far a sale was paid */
  payment: text({ en: 'Payment', ja: '支払い' }),
  /** The payments of a sale */
  payments: text({ en: 'Payments', ja: '支払い' }),
  method: text({ en: 'Payment method', ja: '支払い方法' }),
  /** A payment method the salon removed */
  unlistedMethod: text({
    en: 'Payment method not listed',
    ja: '一覧にない支払い方法',
  }),
  transactionNumber: text({ en: 'Transaction number', ja: '取引番号' }),
  receivedAt: text({ en: 'Time received', ja: '受けた日時' }),
  card: text({ en: 'Card', ja: 'カード' }),
  amount: text({ en: 'Amount', ja: '金額' }),
  amounts: text({ en: 'Amounts', ja: '金額' }),
  item: text({ en: 'Item', ja: '品目' }),
  staff: text({ en: 'Staff', ja: '担当' }),
  quantity: text({ en: 'Quantity', ja: '数量' }),
  unitPrice: text({ en: 'Unit price', ja: '単価' }),
  subtotal: text({ en: 'Subtotal', ja: '小計' }),
  discount: text({ en: 'Discount', ja: '割引' }),
  tax: text({ en: 'Tax', ja: '消費税' }),
  total: text({ en: 'Total', ja: '合計' }),
  /** What a sale that was voided says in place of its payment */
  voided: text({ en: 'Voided', ja: '取り消し' }),
  lineItems: text({ en: 'Line items', ja: '明細' }),
  noLineItems: text({ en: 'No line items', ja: '明細はありません' }),
  checkAddress: text({
    en: 'Check that the address is right.',
    ja: 'アドレスが正しいか、お確かめください。',
  }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  /** The way from a screen of a sale back to the sale */
  toSale: text({ en: 'Back to the sale', ja: '売上の内容へ' }),
}
