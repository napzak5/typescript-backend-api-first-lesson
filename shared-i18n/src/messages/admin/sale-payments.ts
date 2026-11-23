import { type LocalizedText, text } from '../../languages/localized-text'
import { followed, listed } from '../written'
import { SALE_WORDS } from './sale-words'

/*
 * What the payments of a sale say in the admin application: the methods
 * a payment is received by and what each takes at once, the form that
 * records a payment and the one that gives a payment back, why one is not
 * given back, and what is said of the answers. The names of the payment
 * methods, the brands of the cards and the reasons of the refunds stand
 * as they were written.
 */

/** What a method takes at once: its smallest amount, its largest, or both */
export type Limits =
  | { least: LocalizedText; most: LocalizedText | null }
  | { least: null; most: LocalizedText }

/** What a method takes at once, as a part of a sentence: 「￥1,000から」, 「￥50,000まで」, 「￥1,000から￥50,000まで」 */
const limitsIn = ({ least, most }: Limits): LocalizedText => {
  if (least === null) {
    return text({ en: `up to ${most.en}`, ja: `${most.ja}まで` })
  }

  return most === null
    ? text({ en: `${least.en} or more`, ja: `${least.ja}から` })
    : text({
        en: `${least.en} to ${most.en}`,
        ja: `${least.ja}から${most.ja}まで`,
      })
}

export const salePaymentMessages = {
  payment: {
    title: text({ en: 'Record a payment', ja: '支払いを記録する' }),
    submit: text({ en: 'Record the payment', ja: '支払いを記録する' }),
    /** What a sale comes to, above the form: 「合計 ￥5,500、未払い残額 ￥5,500」 */
    owed: (total: LocalizedText, owed: LocalizedText) =>
      text({
        en: `Total ${total.en}, ${owed.en} left to pay`,
        ja: `合計 ${total.ja}、未払い残額 ${owed.ja}`,
      }),
    methodDescription: text({
      en: 'In brackets: what the method takes at a time.',
      ja: '括弧の中は、1 回に受け付ける金額です。',
    }),
    /** What a method takes at once, in a sentence */
    limits: (limits: Limits) =>
      text({
        en: `Takes ${limitsIn(limits).en} at a time.`,
        ja: `1 回 ${limitsIn(limits).ja}受け付けます。`,
      }),
    /** A method as it is offered, with what it takes at once when it has limits: 「現金（￥1,000から）」 */
    methodLabel: (name: string, limits: Limits | null) => {
      if (limits === null) {
        return text({ en: name, ja: name })
      }
      const { least, most } = limits
      if (least === null || most === null) {
        return text({
          en: `${name} (${limitsIn(limits).en})`,
          ja: `${name}（${limitsIn(limits).ja}）`,
        })
      }

      return text({
        en: `${name} (${least.en}–${most.en})`,
        ja: `${name}（${least.ja}〜${most.ja}）`,
      })
    },
    amountDescription: (owed: LocalizedText) =>
      text({
        en: `A whole number of yen. ${owed.en} is left to pay. To take it in parts, enter what was received.`,
        ja: `円の整数で入れます。未払い残額は${owed.ja}です。分けて受け取るときは、受け取った分を入れます。`,
      }),
    cardLastFour: text({
      en: 'Last four digits of the card',
      ja: 'カードの下 4 桁',
    }),
    cardLastFourDescription: text({
      en: 'Only when known. Never the number of the card itself.',
      ja: 'わかるときだけ入れます。カードの番号そのものは入れません。',
    }),
    cardBrand: text({ en: 'Card brand', ja: 'カードのブランド' }),
    cardBrandDescription: text({
      en: 'Only when known (VISA, Mastercard, JCB and so on).',
      ja: 'わかるときだけ入れます（VISA、Mastercard、JCB など）。',
    }),
    /** No method of the salon is in use */
    noMethods: text({
      en: 'This salon uses no payment method. Turn a payment method on in the settings of the salon.',
      ja: 'このサロンには、使っている支払い方法がありません。サロンの設定で、支払い方法を使えるようにしてください。',
    }),
  },
  /** What is wrong with the values of a payment */
  errors: {
    method: text({
      en: 'Choose a payment method.',
      ja: '支払い方法を選んでください。',
    }),
    amount: text({
      en: 'Enter the amount as a whole number of yen, 1 or more.',
      ja: '金額は、1 以上の円の整数で入力してください。',
    }),
    /** More than is left to pay */
    moreThanOwed: (owed: LocalizedText) =>
      text({
        en: `The amount can be at most what is left to pay (${owed.en}).`,
        ja: `金額は、未払い残額（${owed.ja}）以下にしてください。`,
      }),
    /** What the method does not take at once */
    outsideLimits: (name: string, limits: Limits) =>
      text({
        en: `${name} takes ${limitsIn(limits).en} at a time.`,
        ja: `${name}は、1 回 ${limitsIn(limits).ja}受け付けます。`,
      }),
    lastFour: text({
      en: 'Enter the last four digits of the card as 4 digits.',
      ja: 'カードの下 4 桁は、4 桁の数字で入力してください。',
    }),
  },
  /** What is said of the values of a payment the API refused */
  refusals: {
    method: text({
      en: 'This payment method can no longer be used. Choose again.',
      ja: 'この支払い方法は、もう使えません。選び直してください。',
    }),
    tooBig: text({
      en: 'The amount is more than is left to pay, or more than the payment method takes at a time.',
      ja: '未払い残額か、支払い方法が 1 回に受け付ける金額を超えています。',
    }),
    tooSmall: text({
      en: 'The amount is less than the payment method takes at a time.',
      ja: '支払い方法が 1 回に受け付ける金額より少ない金額です。',
    }),
  },
  failed: text({
    en: 'The payment could not be recorded. Check your connection and try again.',
    ja: '支払いを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  notices: {
    recorded: text({
      en: 'Recorded the payment.',
      ja: '支払いを記録しました。',
    }),
    paidInFull: text({
      en: 'Recorded the payment. The total was received, so a receipt can be issued.',
      ja: '支払いを記録しました。合計を受け取ったので、レシートを出せます。',
    }),
  },
  /** Why a sale takes no payment */
  why: {
    voided: text({
      en: 'This sale was voided, so no payment can be recorded.',
      ja: 'この売上は取り消されているため、支払いを記録できません。',
    }),
    refunded: text({
      en: 'This sale has a refund, so no payment can be recorded. To pay again, void the sale and check out again.',
      ja: 'この売上には返金があるため、支払いを記録できません。払い直すときは、売上を取り消して、会計を入れ直してください。',
    }),
    nothingToPay: text({
      en: 'A sale whose total is zero takes no payment.',
      ja: '合計が 0 円の売上は、受け取る支払いがありません。',
    }),
    paid: text({
      en: 'The total of this sale was received.',
      ja: 'この売上は、合計を受け取りました。',
    }),
  },
  /** The payments of a sale, as its page lists them */
  table: {
    status: text({ en: 'Status', ja: '状態' }),
    refund: text({ en: 'Refund', ja: '返金' }),
    /** The link to the refund of a payment, by its number */
    refundOf: (transactionNumber: string) =>
      text({
        en: `Refund ${transactionNumber}`,
        ja: `${transactionNumber} を返金する`,
      }),
    refundLink: text({ en: 'Refund', ja: '返金する' }),
    /** What was given back of a payment, and when as far as it was recorded: 「￥500、2026年11月20日（金） 11:30」 */
    refunded: (amount: LocalizedText, moment: LocalizedText | null) =>
      moment === null ? amount : listed([amount, moment]),
    /** Why a payment was given back, by its number */
    reasonOf: (transactionNumber: string) =>
      text({
        en: `Reason for the refund of ${transactionNumber}`,
        ja: `${transactionNumber} の返金の理由`,
      }),
    empty: text({ en: 'No payments yet', ja: 'まだ支払いはありません' }),
  },
  /** The card of a payment, as far as it was recorded: 「VISA 下 4 桁 4242」 */
  cardOf: (brand: string | null, lastFour: string | null) => {
    if (lastFour === null) {
      return brand === null ? null : text({ en: brand, ja: brand })
    }

    return brand === null
      ? text({ en: `Ending in ${lastFour}`, ja: `下 4 桁 ${lastFour}` })
      : text({
          en: `${brand} ending in ${lastFour}`,
          ja: `${brand} 下 4 桁 ${lastFour}`,
        })
  },
  refund: {
    title: text({ en: 'Refund a payment', ja: '返金する' }),
    payment: text({ en: 'Payment to refund', ja: '返金する支払い' }),
    submit: text({ en: 'Record the refund', ja: '返金を記録する' }),
    amount: text({ en: 'Amount to refund', ja: '返金する金額' }),
    amountDescription: (paid: LocalizedText) =>
      text({
        en: `A whole number of yen, from 1 to the amount of the payment (${paid.en}). A payment is refunded once: after a partial refund, the rest cannot be refunded and the sale cannot be voided.`,
        ja: `円の整数で、1 円から支払いの金額（${paid.ja}）まで入れます。1 件の支払いの返金は 1 回です。一部だけ返金すると、残りは返金できず、売上も取り消せなくなります。`,
      }),
    reason: text({ en: 'Reason for the refund', ja: '返金の理由' }),
    reasonDescription: text({
      en: 'Kept with the refund. Record it after the money was given back.',
      ja: '返金の記録に残ります。お金を返してから記録します。',
    }),
    /** Why a payment is not given back */
    why: {
      refunded: text({
        en: 'This payment was refunded in full.',
        ja: 'この支払いは、全額を返金しました。',
      }),
      partlyRefunded: text({
        en: 'Part of this payment was refunded. A payment is refunded once, so the rest cannot be refunded.',
        ja: 'この支払いは、一部を返金しました。1 件の支払いの返金は 1 回で、残りは返金できません。',
      }),
      notReceived: text({
        en: 'This payment was not received, so it cannot be refunded.',
        ja: 'この支払いは、受け取っていないため、返金できません。',
      }),
      noSuchPayment: followed(
        text({
          en: 'This sale has no such payment.',
          ja: 'この売上に、この支払いはありません。',
        }),
        SALE_WORDS.checkAddress,
      ),
    },
    errors: {
      amount: text({
        en: 'Enter the refund as a whole number of yen, 1 or more.',
        ja: '返金する金額は、1 以上の円の整数で入力してください。',
      }),
      /** More than the payment was */
      moreThanPaid: (paid: LocalizedText) =>
        text({
          en: `The refund can be at most the amount of the payment (${paid.en}).`,
          ja: `返金する金額は、支払いの金額（${paid.ja}）以下にしてください。`,
        }),
      reason: text({
        en: 'Enter the reason for the refund.',
        ja: '返金の理由を入力してください。',
      }),
      tooBig: text({
        en: 'The refund is more than the payment.',
        ja: '返金する金額が、支払いの金額を超えています。',
      }),
    },
    failed: text({
      en: 'The refund could not be recorded. Check your connection and try again.',
      ja: '返金を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    forbidden: text({
      en: 'This account cannot record refunds. Owners and managers can.',
      ja: 'このアカウントでは、返金を記録できません。返金は、オーナーとマネージャーができます。',
    }),
    notices: {
      recorded: text({
        en: 'Recorded the refund.',
        ja: '返金を記録しました。',
      }),
      voidable: text({
        en: 'Recorded the refund. Every payment was refunded in full, so the sale can be voided.',
        ja: '返金を記録しました。すべての支払いを全額返金したので、売上を取り消せます。',
      }),
    },
  },
}
