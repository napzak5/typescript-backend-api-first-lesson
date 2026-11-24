import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { countOf, followed } from '../written'
import { salonHours } from './settings-hours'
import { salonForm } from './settings-salon'
import { CANCEL, SALON_WORDS } from './settings-words'

/*
 * What the screens of the settings of a salon say in the admin
 * application: the settings with the record of the salon and its hours,
 * the information and the hours changed, a salon registered and removed,
 * and who may keep them. The name, the introduction, the address, the
 * contacts, the features and amenities of a salon, the names and notes of
 * its dates, its time zone and its currency stand as they were written.
 */

/** A salon, as a sentence names it: 「サロン「表参道店」」 */
const salonCalled = (name: string): LocalizedText =>
  text({ en: `the salon “${name}”`, ja: `サロン「${name}」` })

/** What a removed salon is no longer, which the removal and its dialog say */
const REMOVED = {
  en: 'it is taken off the list of salons and the screens of the customers, and the staff can no longer use its screens',
  ja: 'サロンの一覧とお客様の画面から消え、スタッフはこのサロンの画面を使えなくなります',
}

export const adminSettingsMessages = {
  titles: {
    settings: text({ en: 'Salon settings', ja: 'サロンの設定' }),
    change: text({
      en: 'Edit the salon information',
      ja: 'サロンの情報を直す',
    }),
    hours: text({ en: 'Edit the hours', ja: '営業時間を直す' }),
    entry: text({ en: 'Register a salon', ja: 'サロンを登録する' }),
  },
  words: { ...SALON_WORDS, cancel: CANCEL },
  loading: {
    settings: text({
      en: 'Loading the salon settings',
      ja: 'サロンの設定を読み込んでいます',
    }),
    salon: text({ en: 'Loading the salon', ja: 'サロンを読み込んでいます' }),
    hours: text({ en: 'Loading the hours', ja: '営業時間を読み込んでいます' }),
  },
  /** The record of a salon */
  record: {
    onlineBooking: text({ en: 'Online booking', ja: 'オンライン予約' }),
    accepting: text({ en: 'Accepted', ja: '受け付ける' }),
    paused: text({ en: 'Paused', ja: '止めている' }),
    rating: text({ en: 'Rating', ja: '評価' }),
    /** How the customers rate the salon: 「4.0（3 件のレビュー）」 */
    ratingOf: (rating: LocalizedText, reviews: number) => {
      const counted = countOf(reviews, 'review', 'reviews', '件のレビュー')

      return text({
        en: `${rating.en} (${counted.en})`,
        ja: `${rating.ja}（${counted.ja}）`,
      })
    },
    notRated: text({ en: 'None yet', ja: 'まだありません' }),
    place: text({ en: 'Place on the map', ja: '地図の位置' }),
    /** The place of a salon on the map: 「緯度 35.658、経度 139.7016」 */
    placeOf: (latitude: LocalizedText, longitude: LocalizedText) =>
      text({
        en: `Latitude ${latitude.en}, longitude ${longitude.en}`,
        ja: `緯度 ${latitude.ja}、経度 ${longitude.ja}`,
      }),
    paymentMethods: text({ en: 'Payment methods', ja: '支払い方法' }),
    toPaymentMethods: text({
      en: 'See the payment methods',
      ja: '支払い方法を見る',
    }),
  },
  ...salonHours,
  ...salonForm,
  /** The removal of a salon, at the end of its settings */
  removal: {
    title: text({ en: 'Remove the salon', ja: 'サロンの削除' }),
    description: (name: string) =>
      text({
        en: `When ${salonCalled(name).en} is removed, ${REMOVED.en}. A removed salon cannot be restored. It cannot be removed while a booking is not finished.`,
        ja: `${salonCalled(name).ja}を削除すると、${REMOVED.ja}。削除したサロンは、元に戻せません。終わっていない予約があるあいだは、削除できません。`,
      }),
    toBookings: text({ en: 'Open the booking ledger', ja: '予約台帳を開く' }),
    ask: text({ en: 'Remove the salon', ja: 'サロンを削除する' }),
    /** The dialog that asks */
    question: (name: string) =>
      text({
        en: `Remove ${salonCalled(name).en}?`,
        ja: `${salonCalled(name).ja}を削除しますか？`,
      }),
    questionDescription: text({
      en: `A removed salon cannot be restored: ${REMOVED.en}.`,
      ja: `削除したサロンは、元に戻せません。${REMOVED.ja}。`,
    }),
    back: uiMessages.back,
    submit: text({ en: 'Remove', ja: '削除する' }),
    done: (name: string) =>
      text({
        en: `Removed ${salonCalled(name).en}.`,
        ja: `${salonCalled(name).ja}を削除しました。`,
      }),
    /** A booking of the salon is not finished: the salon stays */
    bookingsUnfinished: (name: string) =>
      text({
        en: `The salon “${name}” has bookings that are not finished (draft, awaiting confirmation, confirmed, in progress), so it cannot be removed. In the booking ledger, complete them, cancel them or mark them as no-shows, then try again.`,
        ja: `${salonCalled(name).ja}には、終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。予約台帳で、予約を完了するか、キャンセルするか、無断キャンセルにしてから、もう一度お試しください。`,
      }),
    /** The account does not remove the salon */
    forbidden: text({
      en: 'This account cannot remove this salon. Only the owners of that salon and administrators can remove a salon.',
      ja: 'このアカウントでは、このサロンを削除できません。サロンを削除できるのは、そのサロンのオーナーと、管理者です。',
    }),
    failed: text({
      en: 'Could not remove the salon. Check your connection and try again.',
      ja: 'サロンを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** What a screen for the keepers of the settings says to an account that does not keep them */
  keepers: {
    forbidden: followed(
      text({
        en: 'This account cannot change the salon settings.',
        ja: 'このアカウントでは、サロンの設定を変えられません。',
      }),
      text({
        en: 'Only the owners and managers of the salon, and administrators, can change the settings.',
        ja: '設定を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
      }),
    ),
    back: text({ en: 'Back to the settings', ja: '設定へ戻る' }),
  },
}
