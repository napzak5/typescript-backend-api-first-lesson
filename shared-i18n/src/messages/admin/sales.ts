import { type LocalizedText, text } from '../../languages/localized-text'
import { joined, postalCodeOf } from '../written'
import { saleChangeMessages } from './sale-changes'
import { saleCheckoutMessages } from './sale-checkout'
import { salePaymentMessages } from './sale-payments'
import { SALE_WORDS, saleNamed, UNDONE_BY_OTHERS } from './sale-words'

/*
 * What the screens of the sales say in the admin application: the ledger
 * of the sales of a salon and its filter, a sale with its line items and
 * what it comes to, the states of its payment, the receipt to print, the
 * part of the page of a booking that bills it, and the points of its
 * customer. The numbers of the sales and of the receipts, the names of the
 * items and of the payment methods, the notes, the reasons, and the name,
 * the address and the telephone number of the salon stand as they were
 * written.
 *
 * The other parts of the sales are files of their own beside this one,
 * collected here under the same name: the checkout, the payments and the
 * refunds, and the change and the voiding of a sale.
 */

const RECEIPT = text({ en: 'Receipt', ja: 'レシート' })

export const adminSaleMessages = {
  titles: {
    ledger: text({ en: 'Sales ledger', ja: '売上台帳' }),
    sale: text({ en: 'Sale details', ja: '売上の内容' }),
    checkout: saleCheckoutMessages.title,
    payment: salePaymentMessages.payment.title,
    receipt: RECEIPT,
    change: saleChangeMessages.change.title,
    refund: salePaymentMessages.refund.title,
  },
  /** What a screen could not read, and what a sentence names, as it stands there */
  names: {
    sales: text({ en: 'the sales', ja: '売上' }),
    sale: text({ en: 'the sale', ja: '売上' }),
    details: text({ en: 'the sale details', ja: '売上の内容' }),
    methods: text({ en: 'the payment methods', ja: '支払い方法' }),
    staff: text({ en: 'the staff', ja: 'スタッフ' }),
    receipt: text({ en: 'the receipt', ja: 'レシート' }),
    checkout: text({ en: 'the checkout', ja: '会計' }),
    amounts: text({ en: 'the amounts', ja: '金額' }),
    /** What a member of another salon cannot see of this one */
    salesOfTheSalon: text({ en: 'sales', ja: '売上' }),
    checkoutsOfTheSalon: text({ en: 'checkouts', ja: '会計' }),
  },
  loading: {
    sales: text({ en: 'Loading the sales', ja: '売上を読み込んでいます' }),
    sale: text({ en: 'Loading the sale', ja: '売上を読み込んでいます' }),
    details: text({
      en: 'Loading the sale details',
      ja: '売上の内容を読み込んでいます',
    }),
    methods: text({
      en: 'Loading the payment methods',
      ja: '支払い方法を読み込んでいます',
    }),
    staff: text({ en: 'Loading the staff', ja: 'スタッフを読み込んでいます' }),
    receipt: text({
      en: 'Loading the receipt',
      ja: 'レシートを読み込んでいます',
    }),
    checkout: text({
      en: 'Loading the checkout',
      ja: '会計を読み込んでいます',
    }),
    amounts: text({
      en: 'Calculating the amounts',
      ja: '金額を計算しています',
    }),
  },
  words: SALE_WORDS,
  undoneByOthers: UNDONE_BY_OTHERS,
  saleNamed,
  /** How far a sale was paid, by the state the API works out */
  statuses: {
    pending: text({ en: 'Unpaid', ja: '未払い' }),
    processing: text({ en: 'Partly paid', ja: '一部受け取り' }),
    completed: text({ en: 'Paid', ja: '支払い済み' }),
    failed: text({ en: 'Failed', ja: '失敗' }),
    refunded: text({ en: 'Refunded', ja: '返金済み' }),
    partial_refund: text({ en: 'Partly refunded', ja: '一部返金' }),
  },
  /** What became of one payment of a sale */
  paymentStatuses: {
    pending: text({ en: 'Pending', ja: '処理待ち' }),
    processing: text({ en: 'Processing', ja: '処理中' }),
    completed: text({ en: 'Received', ja: '受け取り' }),
    failed: text({ en: 'Failed', ja: '失敗' }),
    refunded: text({ en: 'Refunded', ja: '返金済み' }),
    partial_refund: text({ en: 'Partly refunded', ja: '一部返金' }),
  },
  /** A sale below the heading of its screens, by its number and its time */
  saleOf: (saleNumber: string, moment: LocalizedText) =>
    text({
      en: `Sale ${saleNumber} (${moment.en})`,
      ja: `売上番号 ${saleNumber}（${moment.ja}）`,
    }),
  /** A sale that is not at the address */
  notFound: {
    title: text({ en: 'Sale not found', ja: '売上が見つかりません' }),
    description: SALE_WORDS.checkAddress,
    toToday: text({ en: 'Go to today’s sales', ja: '今日の売上へ' }),
  },
  /** The sales of the days of the ledger */
  ledger: {
    filter: text({ en: 'Filter the sales', ja: '売上を絞り込む' }),
    all: text({ en: 'All', ja: 'すべて' }),
    from: text({ en: 'Date of sale (from)', ja: '会計日（から）' }),
    to: text({ en: 'Date of sale (to)', ja: '会計日（まで）' }),
    /** The sales of a day or of days, as the ledger names them: 「2026年11月20日（金）の売上」 */
    salesOf: (days: LocalizedText) =>
      text({ en: `Sales of ${days.en}`, ja: `${days.ja}の売上` }),
    noSales: (days: LocalizedText) =>
      text({
        en: `No sales of ${days.en}`,
        ja: `${days.ja}の売上はありません`,
      }),
    noneMatches: (days: LocalizedText) =>
      text({
        en: `None of the sales of ${days.en} match the filters`,
        ja: `${days.ja}の売上のうち、条件に合うものはありません`,
      }),
    empty: text({ en: 'No sales', ja: '売上はありません' }),
    /** The way from a sale to the ledger of its day */
    toDay: text({ en: 'Sales of this day', ja: 'この日の売上へ' }),
  },
  /** A sale, as its page shows it */
  record: {
    title: text({ en: 'Sale', ja: '売上' }),
    customer: text({ en: 'Customer', ja: 'お客様' }),
    booking: text({ en: 'Booking', ja: '予約' }),
    toBooking: text({ en: 'Booking details', ja: '予約の内容' }),
    voidedAt: text({ en: 'Time voided', ja: '取り消した日時' }),
    voidReason: saleChangeMessages.void.reason,
    received: text({ en: 'Received', ja: '受け取った金額' }),
    refunded: text({ en: 'Refunded', ja: '返金した金額' }),
    owed: text({ en: 'Left to pay', ja: '未払い残額' }),
    recordPayment: salePaymentMessages.payment.submit,
    issueReceipt: text({ en: 'Issue a receipt', ja: 'レシートを出す' }),
    receiptTitle: RECEIPT,
    receiptExplanation: text({
      en: 'A receipt can be printed and handed to the customer, as often as needed.',
      ja: 'レシートは、印刷してお客様に渡せます。何度でも出し直せます。',
    }),
  },
  /** Why a sale has no receipt */
  noReceipt: {
    voided: text({
      en: 'A voided sale has no receipt.',
      ja: '取り消された売上の、レシートは出せません。',
    }),
    unpaid: text({
      en: 'A receipt can be issued once the total is received.',
      ja: 'レシートは、合計を受け取ってから出せます。',
    }),
    /** The API made none, for a reason the screen does not know */
    unissued: text({
      en: 'This sale has no receipt now. Check the sale.',
      ja: 'この売上のレシートは、いまは出せません。売上の内容を確かめてください。',
    }),
  },
  /** The receipt of a sale, to print */
  receipt: {
    print: text({ en: 'Print', ja: '印刷する' }),
    /** Where the salon is, in one line: 「〒150-0001 東京都 渋谷区 神宮前 4-1-1」; without the postal code of a salon that gave none */
    addressOf: (postalCode: string | null, parts: readonly string[]) =>
      joined(
        [...(postalCode === null ? [] : [postalCodeOf(postalCode)]), ...parts],
        { en: ' ', ja: ' ' },
      ),
    phoneOf: (phoneNumber: string) =>
      text({ en: `Phone ${phoneNumber}`, ja: `電話 ${phoneNumber}` }),
    receiptNumber: text({ en: 'Receipt number', ja: 'レシート番号' }),
    issuedAt: text({ en: 'Issued', ja: '発行日時' }),
    items: text({ en: 'Items purchased', ja: 'お買い上げの明細' }),
    /** A payment, by its method and the card it was made with */
    paidBy: (method: LocalizedText, card: LocalizedText | null) =>
      card === null
        ? text({ en: `Paid (${method.en})`, ja: `お支払い（${method.ja}）` })
        : text({
            en: `Paid (${method.en} ${card.en})`,
            ja: `お支払い（${method.ja} ${card.ja}）`,
          }),
    refunded: text({ en: 'Refunded', ja: 'ご返金' }),
    thanks: text({
      en: 'Thank you for your visit.',
      ja: 'ご来店ありがとうございました。',
    }),
  },
  /** The part of the page of a booking that bills it */
  ofBooking: {
    title: text({ en: 'Checkout', ja: '会計' }),
    forbidden: text({
      en: 'You cannot see the checkout of this booking.',
      ja: 'この予約の会計は、見られません。',
    }),
    notYet: text({
      en: 'Not checked out yet.',
      ja: 'まだ会計を入れていません。',
    }),
  },
  /** The points of the customer of a sale */
  points: {
    title: text({ en: 'Points', ja: 'ポイント' }),
    explanation: text({
      en: 'Record the points the customer used at the counter, and give the points they earn, against this sale.',
      ja: 'お会計で使ったポイントと、付与するポイントを、この売上に結びつけて、お客様のポイントに記録します。',
    }),
    used: text({ en: 'Record points used', ja: '使ったポイントを記録する' }),
    earned: text({ en: 'Give points', ja: 'ポイントを付与する' }),
  },
  checkout: saleCheckoutMessages,
  payments: salePaymentMessages,
  changes: saleChangeMessages,
}
