import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { customerMessages as record } from '../ui/customers'
import { countedIn, followed, joined } from '../written'
import { KEPT_BY_OTHERS, KEYWORD_DESCRIPTION } from './customer-words'

/*
 * Two records of one customer made one: who is kept, whose value an item
 * takes that both have differently, why the API would refuse, and what
 * follows the merge. The names and the addresses of mail of the customers
 * stand as they were written.
 */

const MERGE = text({ en: 'Merge', ja: 'まとめる' })

export const customerMergeMessages = {
  title: text({
    en: 'Merge with another customer',
    ja: 'ほかのお客様とまとめる',
  }),
  /** What a screen could not read, and what a sentence names, as it stands there */
  names: {
    other: text({ en: 'the customer to merge with', ja: 'まとめる相手' }),
    /** The lists of a chart that a merge puts together */
    previousTreatments: text({
      en: 'the treatment history',
      ja: '施術歴',
    }),
    preferredProducts: text({
      en: 'the products to use',
      ja: '使いたい製品',
    }),
    avoidProducts: text({
      en: 'the products to avoid',
      ja: '避けたい製品',
    }),
  },
  /** Who a customer of a merge is, by their name and their address of mail: 「山田 花子 様（hanako@example.com）」 */
  whoIs: (name: string, email: string) =>
    text({ en: `${name} (${email})`, ja: `${name} 様（${email}）` }),
  /** The same of the one chosen, with the reading of the name: 「山田 花子（ヤマダ ハナコ） 様（hanako@example.com）」 */
  chosen: (fullName: LocalizedText, email: string) =>
    text({
      en: `${fullName.en} (${email})`,
      ja: `${fullName.ja} 様（${email}）`,
    }),
  /** The search of the other record */
  search: {
    title: text({ en: 'Customer to merge with', ja: 'まとめる相手' }),
    about: text({
      en: 'When the same customer is in the ledger twice, find and choose the other record, and merge the two into one.',
      ja: '同じお客様が台帳に 2 人いるとき、もう一方を探して選び、1 人にまとめます。',
    }),
    label: text({
      en: 'Find the customer to merge with',
      ja: 'まとめる相手を探す',
    }),
    description: KEYWORD_DESCRIPTION,
    loading: text({
      en: 'Loading the customer to merge with',
      ja: 'まとめる相手を読み込んでいます',
    }),
    notInLedger: text({
      en: 'The chosen customer is not in the ledger. Choose the customer to merge with again.',
      ja: '選んだお客様は、台帳にいません。まとめる相手を選び直してください。',
    }),
    chooseAgain: text({ en: 'Choose again', ja: '相手を選び直す' }),
  },
  /** Whose value an item takes when both customers have one and they differ */
  ways: {
    keep_primary: text({
      en: 'The value of the customer kept',
      ja: '残すお客様の値',
    }),
    keep_secondary: text({
      en: 'The value of the customer merged',
      ja: 'まとめるお客様の値',
    }),
    keep_newest: text({
      en: 'The value of the record changed last',
      ja: 'あとから台帳を直したほうの値',
    }),
  },
  /** The choices and the comparison of the two */
  compared: {
    kept: text({ en: 'Customer to keep', ja: '残すお客様' }),
    thisOne: (who: LocalizedText) =>
      text({ en: `This customer: ${who.en}`, ja: `このお客様: ${who.ja}` }),
    chosenOne: (who: LocalizedText) =>
      text({ en: `Chosen customer: ${who.en}`, ja: `選んだお客様: ${who.ja}` }),
    keptDescription: text({
      en: 'The customer who is not kept is removed from the ledger.',
      ja: '残さないお客様は、台帳から削除されます。',
    }),
    way: text({
      en: 'Items the two have differently',
      ja: '2 人の値が違う項目',
    }),
    wayDescription: text({
      en: 'An item only one of them has keeps that value.',
      ja: '片方だけが値を持つ項目は、その値を残します。',
    }),
    allSame: text({
      en: 'All the items of the two records are the same.',
      ja: '2 人の台帳の項目は、すべて同じです。',
    }),
    caption: text({ en: 'Items that differ', ja: '2 人で違う項目' }),
    item: text({ en: 'Item', ja: '項目' }),
    keptColumn: (name: string) =>
      text({ en: `${name} (kept)`, ja: `残す ${name} 様` }),
    mergedColumn: (name: string) =>
      text({ en: `${name} (merged)`, ja: `まとめる ${name} 様` }),
    merged: text({ en: 'After the merge', ja: 'まとめたあと' }),
    empty: text({ en: 'No items differ', ja: '違う項目はありません' }),
    /** What else of the one merged becomes the kept one's, and the points of both */
    whatMoves: (name: string, points: number) =>
      text({
        en: `The bookings, sales, treatment records and reviews become those of ${name}. The preferences, charts and allergies of the two are put together. The points of the two balances are added up to ${record.pointsOf(points).en}.`,
        ja: `予約、売上、施術記録、レビューは、${name} 様のものになります。好み設定、カルテ、アレルギーは、2 人のものを合わせます。ポイントは、2 人の残高を合わせて ${record.pointsOf(points).ja}になります。`,
      }),
  },
  /** Why the API would refuse to merge the two */
  obstacles: {
    title: text({ en: 'Cannot be merged', ja: 'まとめられません' }),
    accounts: text({
      en: 'Both customers sign in with their own accounts. Accounts cannot be made one, so the two cannot be merged.',
      ja: '2 人とも、ご自分のアカウントでサインインしているお客様です。アカウントは 1 つにまとめられないため、まとめられません。',
    }),
    erasureAsked: (who: LocalizedText) =>
      text({
        en: `A request of ${who.en} to have their data erased was taken. Cancel the request, then merge them.`,
        ja: `${who.ja}から、データの削除の依頼を受け付けています。依頼を取り消してから、まとめてください。`,
      }),
    points: (total: number, most: number) =>
      text({
        en: `Together the two have ${record.pointsOf(total).en}, more than the ${record.pointsOf(most).en} one customer can hold.`,
        ja: `2 人のポイントを合わせると ${record.pointsOf(total).ja}になり、1 人が持てる ${record.pointsOf(most).ja}を超えます。`,
      }),
    /** A list of both charts that holds more than a chart does */
    chart: (list: LocalizedText, most: number) =>
      text({
        en: `Together the two charts have more than ${countedIn(most, 'entry', 'entries')} in ${list.en}. Shorten one of the charts, then merge them.`,
        ja: `2 人のカルテを合わせると、${list.ja}が ${numberOf(most).ja} 件を超えます。どちらかのカルテを短くしてから、まとめてください。`,
      }),
  },
  merge: MERGE,
  back: uiMessages.back,
  /** The dialog that asks before the two are merged */
  confirm: text({
    en: 'Merge the two customers into one?',
    ja: '2 人のお客様を 1 人にまとめますか？',
  }),
  confirmDescription: (kept: LocalizedText, merged: LocalizedText) =>
    text({
      en: `${kept.en} is kept, and ${merged.en} is removed from the ledger. A customer removed by a merge cannot be brought back to the ledger.`,
      ja: `${kept.ja}を残し、${merged.ja}を台帳から削除します。削除したお客様は、台帳に戻せません。`,
    }),
  /** What follows an attempt to merge two customers */
  done: (name: string) =>
    text({
      en: `The two customers were merged into ${name}.`,
      ja: `2 人のお客様を、${name} 様にまとめました。`,
    }),
  /** One of the two, or both, left the ledger in the meantime */
  gone: (who: readonly LocalizedText[]) => {
    const both = joined(who, { en: ' and ', ja: 'と' })

    return followed(
      text({
        en: `No longer in the ledger: ${both.en}.`,
        ja: `${both.ja}は、もう台帳にいません。`,
      }),
      text({
        en: 'On another screen, they were removed from the ledger or merged into another customer.',
        ja: 'ほかの画面で、台帳から削除されたか、ほかのお客様にまとめられました。',
      }),
    )
  },
  refused: text({
    en: 'The records of the two changed in the meantime, so they could not be merged. The two records were loaded again.',
    ja: 'その間に 2 人の記録が変わったため、まとめられませんでした。2 人の記録を読み直しました。',
  }),
  forbidden: followed(
    text({
      en: 'This account cannot merge customers.',
      ja: 'このアカウントでは、お客様をまとめられません。',
    }),
    KEPT_BY_OTHERS,
  ),
  failed: text({
    en: 'The customers could not be merged. Check your connection and try again.',
    ja: 'お客様をまとめられませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
}
