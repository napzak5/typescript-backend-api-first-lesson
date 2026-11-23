import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { joined } from '../written'

/*
 * What the catalogues of the menu share: the words of the values of a
 * service (how its price is decided, where it is in its life, on which
 * days it is given, what a booking of it requires, what an option of it
 * is), whether a service or a category is switched on, the words of the
 * forms and the columns, and who keeps the menu. The names of the
 * categories, the services and the options, their descriptions and tags
 * stand as they were written. Each part of the menu is a file of its own,
 * and `adminMenuMessages` (`menu.ts`) collects them under one name.
 */

/** The parts of a line that says a service in a few words: 「有効・近日公開」, "Active · Coming soon" */
export const inALine = (parts: readonly LocalizedText[]): LocalizedText =>
  joined(parts, { en: ' · ', ja: '・' })

/** Who keeps the menu, said after what the account may not do */
export const MENU_KEPT_BY = text({
  en: 'Only the owners and managers of the salon, and administrators, can change the menu.',
  ja: 'メニューを変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
})

/** The words of the menu that more than one of its parts says */
export const MENU_WORDS = {
  name: text({ en: 'Name', ja: '名前' }),
  category: text({ en: 'Category', ja: 'カテゴリー' }),
  /** The kind of a category, and of an option */
  type: text({ en: 'Type', ja: '種類' }),
  description: text({ en: 'Description', ja: '説明' }),
  displayOrder: text({ en: 'Display order', ja: '表示順' }),
  displayOrderDescription: text({
    en: 'A whole number of 0 or more. Smaller numbers come first.',
    ja: '0 以上の整数。小さいものから並びます。',
  }),
  color: text({ en: 'Color', ja: '色' }),
  status: text({ en: 'Status', ja: '状態' }),
  service: text({ en: 'Service', ja: 'サービス' }),
  duration: text({ en: 'Duration', ja: '所要時間' }),
  price: text({ en: 'Price', ja: '料金' }),
  onlineBooking: text({ en: 'Online booking', ja: 'オンライン予約' }),
  /** Whether a service is booked online: 「受ける」 or 「受けない」 */
  accepted: text({ en: 'Accepted', ja: '受ける' }),
  notAccepted: text({ en: 'Not accepted', ja: '受けない' }),
  pricing: text({ en: 'Pricing', ja: '価格の決め方' }),
  availability: text({ en: 'Availability', ja: '提供日' }),
  staffLevel: text({ en: 'Staff who can do it', ja: '担当できるスタッフ' }),
  everyMember: text({ en: 'All staff', ja: 'すべてのスタッフ' }),
  /** A level of the staff and every level above it: 「シニア以上」 */
  levelOrAbove: (level: LocalizedText) =>
    text({ en: `${level.en} or above`, ja: `${level.ja}以上` }),
  /** A service of no category, and the part of the menu of such services */
  uncategorized: text({ en: 'Uncategorized', ja: '未分類' }),
  /** Whether a service, a category or an option is switched on */
  active: text({ en: 'Active', ja: '有効' }),
  inactive: text({ en: 'Inactive', ja: '無効' }),
  add: text({ en: 'Add', ja: '足す' }),
  save: text({ en: 'Save changes', ja: '変更を保存する' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  remove: text({ en: 'Remove', ja: '削除' }),
  confirmRemoval: text({ en: 'Remove', ja: '削除する' }),
  back: uiMessages.back,
  choose: text({ en: 'Choose', ja: '選んでください' }),
  /** The way from a screen of the menu back to the menu */
  toMenu: text({ en: 'Back to the menu', ja: 'メニューへ' }),
  loadingMenu: text({
    en: 'Loading the menu',
    ja: 'メニューを読み込んでいます',
  }),
  addService: text({ en: 'Add a service', ja: 'サービスを足す' }),
  addCategory: text({ en: 'Add a category', ja: 'カテゴリーを足す' }),
  /** What is wrong with a display order, of a category and of a service */
  displayOrderError: text({
    en: 'Enter the display order as a whole number of 0 or more.',
    ja: '表示順は、0 以上の整数で入力してください。',
  }),
  /** How many of a thing may be chosen: 「3 まで」 */
  upTo: (most: number) =>
    text({
      en: `Up to ${numberOf(most).en}`,
      ja: `${numberOf(most).ja} まで`,
    }),
}

/** How the price of a service is decided */
export const PRICING_NAMES = {
  fixed: text({ en: 'Fixed price', ja: '固定価格' }),
  variable: text({ en: 'Variable price', ja: '変動価格' }),
  tiered: text({ en: 'Tiered price', ja: '段階価格' }),
  dynamic: text({ en: 'Dynamic price', ja: '動的価格' }),
  consultation_based: text({ en: 'Price on consultation', ja: '要相談' }),
}

/** Where a service is in its life */
export const SERVICE_STATUS_NAMES = {
  active: MENU_WORDS.active,
  inactive: text({ en: 'Paused', ja: '一時停止' }),
  coming_soon: text({ en: 'Coming soon', ja: '近日公開' }),
  discontinued: text({ en: 'Discontinued', ja: '廃止' }),
}

/** On which days a service is given */
export const AVAILABILITY_NAMES = {
  always: text({ en: 'Always', ja: '常時提供' }),
  weekdays_only: text({ en: 'Weekdays only', ja: '平日のみ' }),
  weekends_only: text({ en: 'Weekends only', ja: '週末のみ' }),
  by_appointment_only: text({ en: 'By appointment only', ja: '予約制' }),
  seasonal: text({ en: 'Seasonal', ja: '季節限定' }),
}

/** What a booking of a service requires */
export const REQUIREMENT_NAMES = {
  consultation_required: text({
    en: 'Consultation required',
    ja: '事前カウンセリング必須',
  }),
  patch_test_required: text({
    en: 'Patch test required',
    ja: 'パッチテスト必須',
  }),
  advance_booking_required: text({
    en: 'Advance booking required',
    ja: '事前予約必須',
  }),
  deposit_required: text({ en: 'Deposit required', ja: 'デポジット必須' }),
}

/** What an option of a service is */
export const OPTION_TYPE_NAMES = {
  addon: text({ en: 'Add-on', ja: 'アドオン' }),
  upgrade: text({ en: 'Upgrade', ja: 'アップグレード' }),
  duration_extension: text({ en: 'Time extension', ja: '時間延長' }),
  product_choice: text({ en: 'Product choice', ja: '商品選択' }),
}
