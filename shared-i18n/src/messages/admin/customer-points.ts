import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { customerMessages as record } from '../ui/customers'
import { countedIn, followed } from '../written'

/*
 * The points of a customer in the ledger: the balance, the points that
 * expire soon, the history, and the form that records points with what
 * follows it. The points are the customer's, at every salon.
 */

const ENTRY = text({ en: 'Record points', ja: 'ポイントを記録する' })
const BALANCE = text({ en: 'Balance', ja: '残高' })
const MOMENT = text({ en: 'Date and time', ja: '日時' })
const KIND = text({ en: 'Kind', ja: '種類' })
const EXPIRY_DATE = text({ en: 'Expiry date', ja: '有効期限' })
const DESCRIPTION = text({ en: 'Description', ja: '説明' })
const LOADING_BALANCE = text({
  en: 'Loading the balance',
  ja: '残高を読み込んでいます',
})
const COUNT_DESCRIPTION = text({
  en: 'Enter a whole number of 1 or more. To take points away, enter how many to take away.',
  ja: '1 以上の整数で入れます。減らすときも、減らす数を入れます。',
})
const OUTSIDE_A_SALE = text({
  en: 'The points will be recorded without a sale.',
  ja: '売上に結びつけずに記録します。',
})
const RECORD_AGAIN = text({
  en: 'The points could not be recorded. Check your connection and try again.',
  ja: 'ポイントを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
})
const CHECK_THE_HISTORY = text({
  en: 'Check the point history.',
  ja: 'ポイントの履歴をお確かめください。',
})

/** A count of points that moved, with its sign: 「+500」, 「−200」 */
const signedOf = (points: number): LocalizedText => {
  const written = numberOf(Math.abs(points))
  const sign = points < 0 ? '−' : '+'

  return text({ en: `${sign}${written.en}`, ja: `${sign}${written.ja}` })
}

export const customerPointMessages = {
  title: text({ en: 'Points', ja: 'ポイント' }),
  entry: ENTRY,
  /** What a screen could not read, as a sentence names it */
  names: {
    balance: text({ en: 'the balance', ja: '残高' }),
    expiring: text({
      en: 'the points expiring soon',
      ja: '期限が近いポイント',
    }),
    history: text({ en: 'the point history', ja: 'ポイントの履歴' }),
  },
  /** The balance of the customer, with the way to record points */
  balance: {
    title: BALANCE,
    record: ENTRY,
    everywhere: text({
      en: 'Points saved at any salon can be used at every salon.',
      ja: 'ポイントは、どのサロンで貯めたものも、どのサロンでも使えます。',
    }),
    loading: LOADING_BALANCE,
  },
  /** What a form records */
  kinds: {
    earned: text({ en: 'Give points', ja: 'ポイントを付与する' }),
    used: text({ en: 'Record points used', ja: '使ったポイントを記録する' }),
    added: text({ en: 'Add by an adjustment', ja: '調整で増やす' }),
    taken: text({ en: 'Take away by an adjustment', ja: '調整で減らす' }),
  },
  /** What a transaction of the history was, in a word */
  transactions: {
    earned: text({ en: 'Given', ja: '付与' }),
    used: text({ en: 'Used', ja: '利用' }),
    adjusted: text({ en: 'Adjusted', ja: '調整' }),
    expired: text({ en: 'Expired', ja: '失効' }),
    transferred: text({ en: 'Moved by a merge', ja: '統合による移行' }),
  },
  /** How a transaction moved the balance, with its sign: 「+500」, 「−200」 */
  movementOf: signedOf,
  history: {
    title: text({ en: 'Point history', ja: 'ポイントの履歴' }),
    moment: MOMENT,
    kind: KIND,
    movement: text({ en: 'Change', ja: '増減' }),
    balance: BALANCE,
    expiryDate: EXPIRY_DATE,
    reference: text({ en: 'Recorded for', ja: 'もとになった記録' }),
    description: DESCRIPTION,
    empty: text({ en: 'No point history', ja: 'ポイントの履歴はありません' }),
    loading: text({
      en: 'Loading the point history',
      ja: 'ポイントの履歴を読み込んでいます',
    }),
    /** The record a transaction was made for, by its number, while it is read and when it is another salon's */
    saleOf: (saleNumber: string) =>
      text({ en: `Sale ${saleNumber}`, ja: `売上 ${saleNumber}` }),
    sale: text({ en: 'Sale', ja: '売上' }),
    saleOfOtherSalon: text({
      en: 'A sale of another salon',
      ja: 'ほかのサロンの売上',
    }),
    bookingOf: (bookingNumber: string) =>
      text({ en: `Booking ${bookingNumber}`, ja: `予約 ${bookingNumber}` }),
    booking: text({ en: 'Booking', ja: '予約' }),
    bookingOfOtherSalon: text({
      en: 'A booking of another salon',
      ja: 'ほかのサロンの予約',
    }),
    mergedCustomer: text({ en: 'Merged customer', ja: '統合したお客様' }),
  },
  /** The points that expire soon and are not used */
  expiring: {
    title: text({ en: 'Points expiring soon', ja: '期限が近いポイント' }),
    loading: text({
      en: 'Loading the points expiring soon',
      ja: '期限が近いポイントを読み込んでいます',
    }),
    noneWithin: (days: number) =>
      text({
        en: `No points expire within ${countedIn(days, 'day', 'days')}.`,
        ja: `${numberOf(days).ja} 日以内に期限が来るポイントはありません。`,
      }),
    /** How many points expire within the days, and the first day */
    within: (days: number, points: number, first: LocalizedText) =>
      text({
        en: `Points expiring within ${countedIn(days, 'day', 'days')}: ${record.pointsOf(points).en}. The earliest expiry date is ${first.en}.`,
        ja: `${numberOf(days).ja} 日以内に期限が来るポイントは、${record.pointsOf(points).ja}です。最も早い期限は、${first.ja}です。`,
      }),
    pastUsable: text({
      en: 'Points past their expiry date can still be used until they are expired.',
      ja: '期限を過ぎたポイントも、失効させるまでは使えます。',
    }),
    breakdown: text({
      en: 'Breakdown of the points expiring soon',
      ja: '期限が近いポイントの内訳',
    }),
    expiryDate: EXPIRY_DATE,
    /** A day of expiry that is past */
    expired: (day: LocalizedText) =>
      text({ en: `${day.en} (expired)`, ja: `${day.ja}（期限切れ）` }),
    kind: KIND,
    points: record.points,
    moment: MOMENT,
    description: DESCRIPTION,
    empty: text({
      en: 'No points expire soon',
      ja: '期限が近いポイントはありません',
    }),
    asGiven: text({
      en: 'The points in the table are the numbers given (or moved by a merge), not the numbers left unused.',
      ja: '表のポイントは、付与したとき（統合で移したとき）の数で、使われずに残っている数ではありません。',
    }),
  },
  /** The form that records points, and what it says of the values */
  form: {
    record: text({ en: 'Record', ja: '記録する' }),
    kind: text({ en: 'What to record', ja: '記録すること' }),
    points: text({ en: 'Points', ja: 'ポイント数' }),
    /** How a count is typed, with the balance when it was read */
    pointsDescription: (balance: number | undefined) =>
      balance === undefined
        ? COUNT_DESCRIPTION
        : followed(
            COUNT_DESCRIPTION,
            text({
              en: `The balance is now ${record.pointsOf(balance).en}.`,
              ja: `いまの残高は ${record.pointsOf(balance).ja}です。`,
            }),
          ),
    expiryDate: EXPIRY_DATE,
    expiryDescription: text({
      en: 'The points given can be used until this day. Leave it empty for no expiry date.',
      ja: '付与したポイントは、この日まで使えます。空のままなら、期限はありません。',
    }),
    description: DESCRIPTION,
    descriptionDescription: text({
      en: 'It is kept in the point history. For an adjustment, write the reason.',
      ja: 'ポイントの履歴に残ります。調整では、理由を書いておきます。',
    }),
    /** The box that records the points for the sale of the address */
    forSale: (sale: LocalizedText) =>
      text({ en: `Link to ${sale.en}`, ja: `${sale.ja}に結びつける` }),
    forSaleDescription: text({
      en: 'For each sale, points can be given once and points used can be recorded once.',
      ja: '1 つの売上には、ポイントの付与と、使ったポイントの記録を、1 回ずつできます。',
    }),
    cancel: text({ en: 'Cancel', ja: 'やめる' }),
    loading: LOADING_BALANCE,
    kindMissing: text({
      en: 'Choose what to record.',
      ja: '記録することを選んでください。',
    }),
    pointsError: (most: number) =>
      text({
        en: `Enter the points as a whole number from 1 to ${numberOf(most).en}.`,
        ja: `ポイント数は、1 から ${numberOf(most).ja} までの整数で入力してください。`,
      }),
    expiryInThePast: text({
      en: 'The expiry date must be today or later.',
      ja: '有効期限は、今日以降の日付にしてください。',
    }),
    expiryError: (latest: LocalizedText) =>
      text({
        en: `Enter an expiry date from today to ${latest.en}.`,
        ja: `有効期限は、今日から${latest.ja}までの日付で入力してください。`,
      }),
  },
  /** The sale of the address, as the form offers to record the points for it, or why it does not */
  sale: {
    /** 「売上番号 12（2026年11月24日（火） 10:30、¥8,800）」 */
    nameOf: (
      saleNumber: string,
      moment: LocalizedText,
      amount: LocalizedText,
    ) =>
      text({
        en: `sale ${saleNumber} (${moment.en}, ${amount.en})`,
        ja: `売上番号 ${saleNumber}（${moment.ja}、${amount.ja}）`,
      }),
    noCustomer: followed(
      text({
        en: 'The sale in the address records no customer.',
        ja: 'アドレスの売上は、お客様を記録していない売上です。',
      }),
      OUTSIDE_A_SALE,
    ),
    otherCustomer: followed(
      text({
        en: 'The sale in the address is a sale of another customer.',
        ja: 'アドレスの売上は、ほかのお客様の売上です。',
      }),
      OUTSIDE_A_SALE,
    ),
    voided: text({
      en: 'The sale in the address was voided. Points cannot be given or used for a voided sale, so they will be recorded without a sale.',
      ja: 'アドレスの売上は取り消されています。取り消した売上には、ポイントを付与も利用もできないため、売上に結びつけずに記録します。',
    }),
    notFound: followed(
      text({
        en: 'The sale in the address was not found.',
        ja: 'アドレスの売上が見つかりません。',
      }),
      OUTSIDE_A_SALE,
    ),
    unread: text({
      en: 'The sale in the address could not be loaded. To link the points to it, load it again.',
      ja: 'アドレスの売上を読み込めませんでした。売上に結びつけるときは、読み込み直してください。',
    }),
  },
  /** What the notification says of recorded points: what moved, and the balance after it */
  recorded: {
    earned: (points: number) =>
      text({
        en: `Gave ${record.pointsOf(points).en}.`,
        ja: `${record.pointsOf(points).ja}を付与しました。`,
      }),
    used: (points: number) =>
      text({
        en: `Recorded ${record.pointsOf(points).en} used.`,
        ja: `${record.pointsOf(points).ja}を使いました。`,
      }),
    added: (points: number) =>
      text({
        en: `Added ${record.pointsOf(points).en} by an adjustment.`,
        ja: `調整で${record.pointsOf(points).ja}増やしました。`,
      }),
    taken: (points: number) =>
      text({
        en: `Took away ${record.pointsOf(points).en} by an adjustment.`,
        ja: `調整で${record.pointsOf(points).ja}減らしました。`,
      }),
    other: text({ en: 'Recorded the points.', ja: 'ポイントを記録しました。' }),
    /** What was recorded, then the balance it left */
    withBalance: (done: LocalizedText, balance: number) =>
      followed(
        done,
        text({
          en: `The balance is now ${record.pointsOf(balance).en}.`,
          ja: `残高は ${record.pointsOf(balance).ja}です。`,
        }),
      ),
  },
  /** Why the points were not recorded */
  refusals: {
    voidSale: text({
      en: 'Points cannot be given or used for a voided sale.',
      ja: '取り消した売上には、ポイントを付与も利用もできません。',
    }),
    short: (balance: number) =>
      text({
        en: `You cannot take away more than the balance (${record.pointsOf(balance).en}).`,
        ja: `残高（${record.pointsOf(balance).ja}）より多くは減らせません。`,
      }),
    over: (most: number) =>
      text({
        en: `This cannot be recorded: the balance would go over the limit (${record.pointsOf(most).en}).`,
        ja: `残高が上限（${record.pointsOf(most).ja}）を超えるため、記録できません。`,
      }),
    earnedAlready: followed(
      text({
        en: 'Points were already given for this sale.',
        ja: 'この売上には、もうポイントを付与しています。',
      }),
      CHECK_THE_HISTORY,
    ),
    usedAlready: followed(
      text({
        en: 'Points used were already recorded for this sale.',
        ja: 'この売上には、もう使ったポイントを記録しています。',
      }),
      CHECK_THE_HISTORY,
    ),
    saleOfAnother: text({
      en: 'This sale was not found among the sales of this customer. Clear the box that links the points to the sale, then try again.',
      ja: 'この売上は、このお客様の売上として見つかりません。売上に結びつけるチェックを外して、もう一度お試しください。',
    }),
    forbidden: text({
      en: 'This account cannot record these points. Owners and managers adjust points.',
      ja: 'このアカウントでは、このポイントを記録できません。ポイントの調整は、オーナーとマネージャーができます。',
    }),
    failed: RECORD_AGAIN,
  },
}
