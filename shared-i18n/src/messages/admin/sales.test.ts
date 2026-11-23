import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminSaleMessages } from './index'

const { changes, checkout, ledger, payments, receipt, saleNamed, saleOf } =
  adminSaleMessages

/** A moment, a day and days, as the formats write them */
const MOMENT = {
  en: 'Fri, November 20, 2026 at 11:02',
  ja: '2026年11月20日（金） 11:02',
}
const DAY = { en: 'Fri, November 20, 2026', ja: '2026年11月20日（金）' }
const DAYS = {
  en: 'Sun, November 1, 2026 – Fri, November 20, 2026',
  ja: '2026年11月1日（日）〜2026年11月20日（金）',
}

/** Amounts, as the formats write them */
const TOTAL = { en: '¥5,500', ja: '￥5,500' }
const LEAST = { en: '¥1,000', ja: '￥1,000' }
const MOST = { en: '¥20,000', ja: '￥20,000' }

/** A kind of payment, as the words of the business name it */
const CASH = { en: 'Cash', ja: '現金' }
const CARD = { en: 'Credit card', ja: 'クレジットカード' }

/** A payment method, by the name the salon gave it */
const METHOD = { en: 'クレジットカード', ja: 'クレジットカード' }

/** A card, as far as it was recorded */
const VISA = payments.cardOf('VISA', '4242')

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText | null, LocalizedText][] = [
  [
    'adminSaleMessages.saleNamed',
    saleNamed('SL-2KQM-9F4H'),
    { en: 'Sale SL-2KQM-9F4H', ja: '売上番号 SL-2KQM-9F4H' },
  ],
  [
    'adminSaleMessages.saleOf',
    saleOf('SL-2KQM-9F4H', MOMENT),
    {
      en: 'Sale SL-2KQM-9F4H (Fri, November 20, 2026 at 11:02)',
      ja: '売上番号 SL-2KQM-9F4H（2026年11月20日（金） 11:02）',
    },
  ],
  [
    'adminSaleMessages.ledger.salesOf',
    ledger.salesOf(DAY),
    {
      en: 'Sales of Fri, November 20, 2026',
      ja: '2026年11月20日（金）の売上',
    },
  ],
  [
    'adminSaleMessages.ledger.noSales',
    ledger.noSales(DAYS),
    {
      en: 'No sales of Sun, November 1, 2026 – Fri, November 20, 2026',
      ja: '2026年11月1日（日）〜2026年11月20日（金）の売上はありません',
    },
  ],
  [
    'adminSaleMessages.ledger.noneMatches',
    ledger.noneMatches(DAY),
    {
      en: 'None of the sales of Fri, November 20, 2026 match the filters',
      ja: '2026年11月20日（金）の売上のうち、条件に合うものはありません',
    },
  ],
  [
    'adminSaleMessages.receipt.addressOf',
    receipt.addressOf('150-0001', ['東京都', '渋谷区', '神宮前 4-1-1']),
    {
      en: '150-0001 東京都 渋谷区 神宮前 4-1-1',
      ja: '〒150-0001 東京都 渋谷区 神宮前 4-1-1',
    },
  ],
  [
    'adminSaleMessages.receipt.phoneOf',
    receipt.phoneOf('03-1234-5678'),
    { en: 'Phone 03-1234-5678', ja: '電話 03-1234-5678' },
  ],
  [
    'adminSaleMessages.receipt.paidBy',
    receipt.paidBy(METHOD, VISA),
    {
      en: 'Paid (クレジットカード VISA ending in 4242)',
      ja: 'お支払い（クレジットカード VISA 下 4 桁 4242）',
    },
  ],
  [
    'adminSaleMessages.checkout.form.removeLine',
    checkout.form.removeLine('カラー', 2),
    { en: 'Remove カラー (line 2)', ja: 'カラー（2 件目）を外す' },
  ],
  [
    'adminSaleMessages.checkout.form.offered',
    checkout.form.offered('カット', TOTAL),
    { en: 'カット (¥5,500)', ja: 'カット（￥5,500）' },
  ],
  [
    'adminSaleMessages.checkout.form.kinds',
    checkout.form.kinds([CASH, CARD]),
    { en: 'Cash, Credit card', ja: '現金、クレジットカード' },
  ],
  [
    'adminSaleMessages.checkout.bill.gone',
    checkout.bill.gone(['カラー', 'カット']),
    {
      en: 'カラー, カット were removed from the menu. Take them off.',
      ja: 'カラー、カットは、メニューから削除されていました。外してください。',
    },
  ],
  [
    'adminSaleMessages.checkout.notices.added',
    checkout.notices.added('カラー'),
    { en: 'Added カラー.', ja: 'カラーを足しました。' },
  ],
  [
    'adminSaleMessages.checkout.notices.removed',
    checkout.notices.removed('カラー'),
    { en: 'Removed カラー.', ja: 'カラーを外しました。' },
  ],
  [
    'adminSaleMessages.payments.payment.owed',
    payments.payment.owed(TOTAL, LEAST),
    {
      en: 'Total ¥5,500, ¥1,000 left to pay',
      ja: '合計 ￥5,500、未払い残額 ￥1,000',
    },
  ],
  [
    'adminSaleMessages.payments.payment.limits',
    payments.payment.limits({ least: LEAST, most: MOST }),
    {
      en: 'Takes ¥1,000 to ¥20,000 at a time.',
      ja: '1 回 ￥1,000から￥20,000まで受け付けます。',
    },
  ],
  [
    'adminSaleMessages.payments.payment.methodLabel',
    payments.payment.methodLabel('現金', { least: LEAST, most: MOST }),
    { en: '現金 (¥1,000–¥20,000)', ja: '現金（￥1,000〜￥20,000）' },
  ],
  [
    'adminSaleMessages.payments.payment.amountDescription',
    payments.payment.amountDescription(TOTAL),
    {
      en: 'A whole number of yen. ¥5,500 is left to pay. To take it in parts, enter what was received.',
      ja: '円の整数で入れます。未払い残額は￥5,500です。分けて受け取るときは、受け取った分を入れます。',
    },
  ],
  [
    'adminSaleMessages.payments.errors.moreThanOwed',
    payments.errors.moreThanOwed(TOTAL),
    {
      en: 'The amount can be at most what is left to pay (¥5,500).',
      ja: '金額は、未払い残額（￥5,500）以下にしてください。',
    },
  ],
  [
    'adminSaleMessages.payments.errors.outsideLimits',
    payments.errors.outsideLimits('交通系 IC', { least: null, most: MOST }),
    {
      en: '交通系 IC takes up to ¥20,000 at a time.',
      ja: '交通系 ICは、1 回 ￥20,000まで受け付けます。',
    },
  ],
  [
    'adminSaleMessages.payments.table.refundOf',
    payments.table.refundOf('PY-7XWN-3P2R'),
    { en: 'Refund PY-7XWN-3P2R', ja: 'PY-7XWN-3P2R を返金する' },
  ],
  [
    'adminSaleMessages.payments.table.refunded',
    payments.table.refunded(LEAST, MOMENT),
    {
      en: '¥1,000, Fri, November 20, 2026 at 11:02',
      ja: '￥1,000、2026年11月20日（金） 11:02',
    },
  ],
  [
    'adminSaleMessages.payments.table.reasonOf',
    payments.table.reasonOf('PY-7XWN-3P2R'),
    {
      en: 'Reason for the refund of PY-7XWN-3P2R',
      ja: 'PY-7XWN-3P2R の返金の理由',
    },
  ],
  [
    'adminSaleMessages.payments.cardOf',
    VISA,
    { en: 'VISA ending in 4242', ja: 'VISA 下 4 桁 4242' },
  ],
  [
    'adminSaleMessages.payments.refund.amountDescription',
    payments.refund.amountDescription(TOTAL),
    {
      en: 'A whole number of yen, from 1 to the amount of the payment (¥5,500). A payment is refunded once: after a partial refund, the rest cannot be refunded and the sale cannot be voided.',
      ja: '円の整数で、1 円から支払いの金額（￥5,500）まで入れます。1 件の支払いの返金は 1 回です。一部だけ返金すると、残りは返金できず、売上も取り消せなくなります。',
    },
  ],
  [
    'adminSaleMessages.payments.refund.errors.moreThanPaid',
    payments.refund.errors.moreThanPaid(TOTAL),
    {
      en: 'The refund can be at most the amount of the payment (¥5,500).',
      ja: '返金する金額は、支払いの金額（￥5,500）以下にしてください。',
    },
  ],
  [
    'adminSaleMessages.changes.void.description',
    changes.void.description(saleNamed('SL-2KQM-9F4H')),
    {
      en: 'Sale SL-2KQM-9F4H will be voided. A voided sale stays in the sales ledger as a record of the voiding, and can be neither edited nor paid. The booking can be checked out again. Voiding cannot be undone.',
      ja: '売上番号 SL-2KQM-9F4Hを取り消します。取り消した売上は、取り消しの記録として売上台帳に残り、直すことも支払いを受けることもできません。予約の会計は、入れ直せます。取り消しは、元に戻せません。',
    },
  ],
  [
    'adminSaleMessages.changes.void.paymentsChanged',
    changes.void.paymentsChanged(changes.void.why.received),
    {
      en: 'The payments of this sale changed meanwhile. This sale has payments that were received, so it cannot be voided as it is. Refund every payment in full first.',
      ja: 'その間に、この売上の支払いが変わりました。受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。',
    },
  ],
]

describe('the messages of the sales of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminSaleMessages }, '').made.toSorted(),
    )
  })

  it('should write the address of a salon without the postal code and the building it did not give', () => {
    // Assert
    expect(
      receipt.addressOf(null, ['東京都', '渋谷区', '神宮前 4-1-1']),
    ).toEqual({
      en: '東京都 渋谷区 神宮前 4-1-1',
      ja: '東京都 渋谷区 神宮前 4-1-1',
    })
  })

  it('should name a payment by its method alone when nothing of its card was recorded', () => {
    // Assert
    expect(receipt.paidBy(METHOD, payments.cardOf(null, null))).toEqual({
      en: 'Paid (クレジットカード)',
      ja: 'お支払い（クレジットカード）',
    })
  })

  it('should name a card by what of it was recorded', () => {
    // Assert
    expect(payments.cardOf('JCB', null)).toEqual({ en: 'JCB', ja: 'JCB' })
    expect(payments.cardOf(null, '0005')).toEqual({
      en: 'Ending in 0005',
      ja: '下 4 桁 0005',
    })
  })

  it('should say the limits of a method that has one of them', () => {
    // Assert
    expect(payments.payment.limits({ least: LEAST, most: null })).toEqual({
      en: 'Takes ¥1,000 or more at a time.',
      ja: '1 回 ￥1,000から受け付けます。',
    })
    expect(
      payments.payment.methodLabel('現金', { least: null, most: MOST }),
    ).toEqual({
      en: '現金 (up to ¥20,000)',
      ja: '現金（￥20,000まで）',
    })
    expect(payments.payment.methodLabel('現金', null)).toEqual({
      en: '現金',
      ja: '現金',
    })
  })

  it('should say a refund alone when its time was not recorded', () => {
    // Assert
    expect(payments.table.refunded(LEAST, null)).toEqual(LEAST)
  })

  it('should say that one service was removed from the menu', () => {
    // Assert
    expect(checkout.bill.gone(['カラー'])).toEqual({
      en: 'カラー was removed from the menu. Take it off.',
      ja: 'カラーは、メニューから削除されていました。外してください。',
    })
  })
})
