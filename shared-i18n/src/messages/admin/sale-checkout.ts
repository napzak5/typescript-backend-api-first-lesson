import { type LocalizedText, text } from '../../languages/localized-text'
import { listed } from '../written'
import { SALE_WORDS } from './sale-words'

/*
 * What the checkout of a booking says in the admin application: when a
 * booking is checked out, its form with the services of the booking and
 * those added at the counter, the amounts the API calculates, and what is
 * said of the answer. The names of the services and of the staff stand as
 * they were written.
 */

const TITLE = text({ en: 'Check out', ja: '会計を入れる' })

const TOO_BIG = text({
  en: 'The total is more than one sale can hold. Take off some of the added services.',
  ja: '金額の合計が、1 件の売上で扱える上限を超えます。足した施術を減らしてください。',
})

export const saleCheckoutMessages = {
  title: TITLE,
  /** Why a booking is not checked out, by its state */
  why: {
    cancelled: text({
      en: 'A cancelled booking, or one whose customer did not come, is not checked out.',
      ja: 'キャンセルした予約には、会計を入れません。',
    }),
    notBegun: text({
      en: 'A booking can be checked out once its treatment has begun.',
      ja: '会計は、施術を始めると入れられます。',
    }),
  },
  form: {
    submit: TITLE,
    service: text({ en: 'Service', ja: 'メニュー' }),
    price: text({ en: 'Price', ja: '料金' }),
    booked: text({ en: 'Booked services', ja: '予約の施術' }),
    noBooked: text({ en: 'No booked services', ja: '予約の施術はありません' }),
    added: text({ en: 'Added services', ja: '足した施術' }),
    noAdded: text({
      en: 'Add the services that were done beyond the booking from the menu',
      ja: '予約にない施術をしたときは、メニューから足してください',
    }),
    remove: text({ en: 'Remove', ja: '外す' }),
    /** The button that takes an added service off, by its name and its place */
    removeLine: (name: string, place: number) =>
      text({
        en: `Remove ${name} (line ${place})`,
        ja: `${name}（${place} 件目）を外す`,
      }),
    toAdd: text({ en: 'Service to add', ja: '足す施術' }),
    /** A service of the menu, with its price: 「カット（￥5,500）」 */
    offered: (name: string, price: LocalizedText) =>
      text({ en: `${name} (${price.en})`, ja: `${name}（${price.ja}）` }),
    toAddDescription: text({
      en: 'Counted at the price of the menu now, done by the staff member of the booking.',
      ja: 'いまのメニューの料金で数えます。担当は、予約の担当です。',
    }),
    add: text({ en: 'Add the service', ja: '施術を足す' }),
    recommended: text({
      en: 'Payment methods that take the total at once',
      ja: '1 回で受け取れる支払い方法',
    }),
    /** The kinds of payment that take the total at once, one after the other */
    kinds: (kinds: readonly LocalizedText[]) => listed(kinds),
    recalculate: text({ en: 'Calculate again', ja: '計算し直す' }),
    record: text({ en: 'Record of the sale', ja: '会計の記録' }),
    cashierDescription: text({
      en: 'The staff member who took the payment, recorded as the staff of the sale.',
      ja: '支払いを受けたスタッフです。売上の担当として記録します。',
    }),
  },
  /** Why the screen shows no amounts */
  bill: {
    otherPrices: text({
      en: 'A price of the menu changed after this screen was opened. Calculate again to count the prices of now.',
      ja: 'メニューの料金が、この画面を開いたあとで変わりました。計算し直すと、いまの料金で数えます。',
    }),
    forbidden: text({
      en: 'You cannot check out at this salon.',
      ja: 'このサロンの会計は、入れられません。',
    }),
    /** The services that were added and removed from the menu meanwhile, by name */
    gone: (names: readonly string[]) =>
      names.length === 1
        ? text({
            en: `${listed(names).en} was removed from the menu. Take it off.`,
            ja: `${listed(names).ja}は、メニューから削除されていました。外してください。`,
          })
        : text({
            en: `${listed(names).en} were removed from the menu. Take them off.`,
            ja: `${listed(names).ja}は、メニューから削除されていました。外してください。`,
          }),
    bookingRemoved: text({
      en: 'This booking was removed.',
      ja: 'この予約は、削除されていました。',
    }),
    tooBig: TOO_BIG,
    uncalculated: text({
      en: 'The amounts could not be calculated.',
      ja: '金額を計算できませんでした。',
    }),
  },
  /** What is said of the values the API refused */
  refusals: {
    staffGone: text({
      en: 'This staff member can no longer be chosen. Choose again.',
      ja: 'このスタッフは、もう選べません。選び直してください。',
    }),
    customerRemoved: text({
      en: 'The customer of this booking was removed from the ledger, so the sale could not be entered.',
      ja: 'この予約のお客様は、台帳から削除されていたため、会計を入れられませんでした。',
    }),
    notBillable: text({
      en: 'This booking can no longer be checked out. Check the booking.',
      ja: 'この予約は、会計を入れられる予約ではなくなっていました。予約を確かめてください。',
    }),
    detailsGone: text({
      en: 'A service or a staff member was removed meanwhile, so the sale could not be entered. Open the checkout again from the booking.',
      ja: 'メニューか担当のスタッフが、その間に削除されていたため、会計を入れられませんでした。予約の内容から開き直してください。',
    }),
    tooBig: TOO_BIG,
  },
  /** What is said of an attempt that did nothing */
  again: {
    failed: text({
      en: 'The sale could not be entered. Check your connection and try again.',
      ja: '会計を入れられませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    unbillable: text({
      en: 'The time zone of the salon is not valid, so the date of the sale could not be set and the sale was not entered. Correct the settings of the salon.',
      ja: 'サロンのタイムゾーンが正しくないため、会計日を決められず、会計を入れられませんでした。サロンの設定を直してください。',
    }),
    forbidden: text({
      en: 'You cannot check out at this salon. Only its staff and administrators can.',
      ja: 'このサロンの会計は、入れられません。会計を入れられるのは、そのサロンのスタッフと、管理者です。',
    }),
    noBill: text({
      en: 'Wait for the amounts before checking out.',
      ja: '金額が出てから、会計を入れてください。',
    }),
  },
  notices: {
    done: text({ en: 'Checked out.', ja: '会計を入れました。' }),
    billed: text({
      en: 'This booking was checked out meanwhile. Here is that sale.',
      ja: 'この予約には、その間に会計が入っていました。その売上を表示します。',
    }),
    added: (name: string) =>
      text({ en: `Added ${name}.`, ja: `${name}を足しました。` }),
    removed: (name: string) =>
      text({ en: `Removed ${name}.`, ja: `${name}を外しました。` }),
  },
  /** A booking that has a sale already */
  billedAlready: text({
    en: 'This booking was checked out. A booking is checked out once.',
    ja: 'この予約には、会計が入っています。1 件の予約に入れる会計は、1 件です。',
  }),
  /** The way from the booking to the sale that bills it */
  toSale: SALE_WORDS.toSale,
}
