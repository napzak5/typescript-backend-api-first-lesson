import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { customerMessages as record } from '../ui/customers'
import { salonScreenMessages } from '../ui/salon-screens'
import { followed, joined, listed, postalCodeOf } from '../written'
import { customerBulkMessages } from './customer-bulk'
import { customerErasureMessages } from './customer-erasure'
import { customerExportMessages } from './customer-export'
import { customerFileMessages } from './customer-file'
import { customerMergeMessages } from './customer-merge'
import { customerPointMessages } from './customer-points'
import {
  countOf,
  honored,
  KEPT_BY_OTHERS,
  KEYWORD_DESCRIPTION,
} from './customer-words'

/*
 * What the screens of the ledger of the customers say in the admin
 * application: the ledger and its search, a customer registered, shown and
 * changed, the choice of the customer who referred another, the change of
 * the preferences, the use of the salon, the removal and the way back, the
 * history and its versions. The names of the customers, their notes and
 * tags, and the name of the salon stand as they were written.
 *
 * The other parts of the ledger are files of their own beside this one,
 * collected here under the same name: the points, the file of customers to
 * register, the merge, what is done at once to the chosen customers, the
 * exports, and the requests to have the data erased.
 */

const TITLES = {
  ledger: text({ en: 'Customer ledger', ja: '顧客台帳' }),
  entry: text({ en: 'Register a customer', ja: 'お客様を登録する' }),
  change: text({ en: 'Edit the record', ja: '台帳を直す' }),
  preferences: text({ en: 'Edit the preferences', ja: '好み設定を直す' }),
  customer: text({ en: 'Customer record', ja: 'お客様の台帳' }),
  history: text({ en: 'Change history', ja: '変更履歴' }),
  version: text({ en: 'Record version', ja: '台帳の版' }),
}

const STATUS = text({ en: 'Status', ja: 'ステータス' })
const TAGS = text({ en: 'Tags', ja: 'タグ' })
const LAST_VISIT = text({ en: 'Last visit', ja: '最終来店日' })
const NO_VISIT = text({ en: 'No visits', ja: '来店なし' })
const NO_CUSTOMERS = text({ en: 'No customers', ja: 'お客様はいません' })
const HAIR_AND_SCALP = text({ en: 'Hair and scalp', ja: '髪と頭皮' })
const PREFERENCE_NOTES = text({
  en: 'Notes on preferences',
  ja: '好みについてのメモ',
})
const REFERRED_BY = text({ en: 'Referred by', ja: '紹介元' })
const CONTACTS = text({ en: 'Messages allowed', ja: '送ってよい連絡' })
const NOTES = text({ en: 'Notes', ja: '備考' })
const INTERNAL_NOTES = text({
  en: 'Notes between staff',
  ja: 'スタッフ間の申し送り',
})
const CHECK_THE_ADDRESS = text({
  en: 'Check that the address is right.',
  ja: 'アドレスが正しいか、お確かめください。',
})
const GONE = text({
  en: 'This customer was removed from the ledger.',
  ja: 'このお客様は、台帳から削除されました。',
})

/** The name of a customer, with how it is read when there is a reading: 「山田 花子（ヤマダ ハナコ）」 */
const fullName = (name: string, kana: string): LocalizedText =>
  kana === ''
    ? text({ en: name, ja: name })
    : text({ en: `${name} (${kana})`, ja: `${name}（${kana}）` })

export const adminCustomerMessages = {
  titles: TITLES,
  /** The link from a screen of a customer (the history, the points) back to their page */
  backToCustomer: text({
    en: 'Back to the customer',
    ja: 'お客様の台帳へ',
  }),
  /** What a screen could not read, as a sentence names it: in English with its article */
  names: {
    ledger: text({ en: 'the customer ledger', ja: '顧客台帳' }),
    customers: text({ en: 'the customers', ja: 'お客様' }),
    customer: text({ en: 'the customer', ja: 'お客様' }),
    referrer: text({ en: 'the referrer', ja: '紹介元' }),
    preferences: text({ en: 'the preferences', ja: '好み設定' }),
    /** What the use of the salon counts, which a member of another salon is not shown either */
    usage: text({ en: 'usage figures', ja: '利用の集計' }),
    history: text({ en: 'the change history', ja: '変更履歴' }),
    version: text({ en: 'the version', ja: '版' }),
    previousVersion: text({ en: 'the version before', ja: '前の版' }),
  },
  /** How the staff name a customer in a sentence: 「山田 花子 様」; English names them alone */
  naming: {
    honored,
    full: fullName,
    /** The full name below the heading of a screen of a customer: 「山田 花子（ヤマダ ハナコ） 様」 */
    honoredFull: (name: string, kana: string) => {
      const full = fullName(name, kana)

      return text({ en: full.en, ja: `${full.ja} 様` })
    },
  },
  ledger: {
    register: TITLES.entry,
    importFile: text({
      en: 'Register from a CSV file',
      ja: 'CSV から登録する',
    }),
    searchCharts: text({ en: 'Search the charts', ja: 'カルテを探す' }),
    exportFile: text({ en: 'Export as CSV', ja: 'CSV に出力する' }),
    loading: text({
      en: 'Loading the customers',
      ja: 'お客様を読み込んでいます',
    }),
    noneMatch: text({
      en: 'No customers match these filters',
      ja: '条件に合うお客様はいません',
    }),
    noneMatchDescription: text({
      en: 'Change the filters, or register the customer as a new one.',
      ja: '条件を変えて探すか、新しいお客様として登録してください。',
    }),
    empty: text({
      en: 'There are no customers in the ledger',
      ja: '台帳にお客様はいません',
    }),
    emptyDescription: text({
      en: 'Register the first customer.',
      ja: '最初のお客様を登録してください。',
    }),
    /** The caption of the table when filters narrow it */
    matching: text({
      en: 'Customers matching the filters',
      ja: '条件に合うお客様',
    }),
  },
  filter: {
    label: text({ en: 'Search for customers', ja: 'お客様を探す' }),
    tags: TAGS,
    tagsDescription: text({
      en: 'Separate tags with commas to find the customers who have all of them.',
      ja: '「、」か「,」で区切ると、すべてのタグを持つお客様を探します。',
    }),
    from: text({ en: 'Registered from', ja: '登録日（から）' }),
    to: text({ en: 'Registered until', ja: '登録日（まで）' }),
    status: STATUS,
    tier: record.membershipTier,
    /** The first choice of a condition, which narrows nothing */
    all: text({ en: 'All', ja: 'すべて' }),
    keyword: salonScreenMessages.keyword,
    keywordDescription: KEYWORD_DESCRIPTION,
  },
  /** The table of the ledger */
  table: {
    choose: text({ en: 'Select', ja: '選ぶ' }),
    /** The checkbox of a row, named after its customer */
    chooseCustomer: (name: string) =>
      text({ en: `Select ${name}`, ja: `${name} 様を選ぶ` }),
    name: record.parts.name,
    kana: record.kana,
    phoneNumber: record.phoneNumber,
    tier: record.membershipTier,
    status: STATUS,
    visits: record.visits,
    lastVisit: LAST_VISIT,
    noVisit: NO_VISIT,
    empty: NO_CUSTOMERS,
  },
  /** The customers a keyword found, to choose one of */
  choices: {
    caption: text({ en: 'Customers found', ja: '見つかったお客様' }),
    name: record.parts.name,
    kana: record.kana,
    phoneNumber: record.phoneNumber,
    email: record.email,
    /** The customer the screen is about, who cannot be chosen */
    thisCustomer: (name: string) =>
      text({ en: `${name} (this customer)`, ja: `${name}（このお客様）` }),
    empty: NO_CUSTOMERS,
    searching: text({
      en: 'Searching for customers',
      ja: 'お客様を探しています',
    }),
    noneFound: text({
      en: 'No customers have this keyword',
      ja: 'キーワードに合うお客様が見つかりませんでした',
    }),
    noneFoundDescription: text({
      en: 'Change the keyword and search again.',
      ja: 'キーワードを変えて、もう一度お探しください。',
    }),
  },
  /** The form of a customer: the parts of it, its controls and what they say */
  form: {
    parts: {
      ...record.parts,
      about: text({ en: 'About the customer', ja: 'お客様について' }),
      hair: HAIR_AND_SCALP,
      likes: text({ en: 'Preferences', ja: '好み' }),
      treatment: text({ en: 'At the salon', ja: 'サロンでの扱い' }),
      referral: text({ en: 'Referral', ja: '紹介' }),
      contacts: CONTACTS,
      notes: text({ en: 'Notes', ja: 'メモ' }),
    },
    emailDescription: text({
      en: 'No two customers of the ledger can have the same address.',
      ja: '台帳のお客様の間で、同じアドレスは使えません。',
    }),
    /** The first choice of a value the ledger may leave unrecorded */
    unrecorded: text({ en: 'Do not record', ja: '記録しない' }),
    preferenceNotes: PREFERENCE_NOTES,
    preferenceNotesDescription: text({
      en: 'Products to use, what the customer dislikes, and the like. The customer can change this in their profile too.',
      ja: '使ってほしい製品や、苦手なことなどです。お客様もプロフィールで書き換えられます。',
    }),
    status: STATUS,
    statusDescription: text({
      en: 'Dormant and suspended customers cannot book by themselves.',
      ja: '休眠と利用停止のお客様は、ご自分では予約を入れられません。',
    }),
    active: text({ en: 'Active customer', ja: '有効なお客様' }),
    activeDescription: text({
      en: 'When this is cleared, the customer can no longer book or change the time of a booking by themselves. The salon can book for them either way.',
      ja: '外すと、お客様はご自分では予約を入れたり、日時を変えたりできなくなります。サロンが入れる予約は、どちらでも入れられます。',
    }),
    tags: TAGS,
    tagsDescription: text({
      en: 'Separate tags with commas; add as many as you like.',
      ja: '「、」か「,」で区切って、いくつでも付けられます。',
    }),
    referralCodeDescription: text({
      en: 'The code this customer gives when they refer someone. No two customers can have the same code, customers removed from the ledger included.',
      ja: 'このお客様が、ほかの方を紹介するときのコードです。台帳から削除したお客様のものも含めて、同じコードは使えません。',
    }),
    notes: NOTES,
    internalNotes: INTERNAL_NOTES,
    /** What the notes of the salon say of who reads them */
    hidden: text({
      en: 'The customer does not see this.',
      ja: 'お客様には見えません。',
    }),
    register: text({ en: 'Register', ja: '登録する' }),
    save: text({ en: 'Save changes', ja: '変更を保存する' }),
    cancel: text({ en: 'Cancel', ja: 'やめる' }),
  },
  /** The customer who referred another, chosen from the ledger */
  referrer: {
    label: REFERRED_BY,
    description: text({
      en: 'The customer who referred this one, searched for in the ledger.',
      ja: 'このお客様を紹介したお客様です。台帳から探して選びます。',
    }),
    choose: text({ en: 'Choose the referrer', ja: '紹介元を選ぶ' }),
    remove: text({ en: 'Remove the referrer', ja: '紹介元を外す' }),
    dialogDescription: text({
      en: 'Search the ledger for the customer who referred this one, and choose them.',
      ja: 'このお客様を紹介したお客様を、台帳から探して選びます。',
    }),
    search: text({ en: 'Search for the referrer', ja: '紹介元を探す' }),
    keyword: salonScreenMessages.keyword,
    keywordDescription: KEYWORD_DESCRIPTION,
    /** A referrer who was removed from the ledger since */
    gone: text({
      en: 'A customer no longer in the ledger',
      ja: '台帳にいないお客様',
    }),
    /** The link to the referrer before they were read, or when they cannot be */
    link: text({ en: 'Referring customer', ja: '紹介したお客様' }),
    loading: text({
      en: 'Loading the referrer',
      ja: '紹介元を読み込んでいます',
    }),
    /** The API refused the customer themselves as their referrer */
    themselves: text({
      en: 'A customer cannot be their own referrer. Choose another customer.',
      ja: 'お客様ご自身は、紹介元に選べません。ほかのお客様を選んでください。',
    }),
    /** The API refused a referrer who is not in the ledger: removed while the form was open */
    absent: text({
      en: 'The customer you chose is not in the ledger. Choose the referrer again, or remove it.',
      ja: '選んだお客様は、台帳にいません。紹介元を選び直すか、外してください。',
    }),
  },
  /** What a form of the ledger says after the API did not take it */
  refusals: {
    emailTaken: text({
      en: 'A customer with this email address is already in the ledger. Search for them in the ledger, or enter another email address.',
      ja: 'このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
    }),
    referralCodeTaken: text({
      en: 'Another customer uses this referral code (customers removed from the ledger included). Enter another code.',
      ja: 'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを入力してください。',
    }),
    /** The account no longer belongs to a salon */
    cannotHandle: text({
      en: 'This account cannot work with the customer ledger.',
      ja: 'このアカウントでは、顧客台帳を扱えません。',
    }),
    entryFailed: text({
      en: 'The customer could not be registered. Check your connection and try again.',
      ja: 'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    changeFailed: text({
      en: 'The record could not be changed. Check your connection and try again.',
      ja: '台帳を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** What the notifications say after a write */
  notices: {
    registered: (name: string) =>
      text({
        en: `${name} was registered in the ledger.`,
        ja: `${name} 様を台帳に登録しました。`,
      }),
    changed: text({ en: 'The record was changed.', ja: '台帳を直しました。' }),
    preferencesChanged: text({
      en: 'The preferences were changed.',
      ja: '好み設定を直しました。',
    }),
    removed: (name: string) =>
      text({
        en: `${name} was removed from the ledger.`,
        ja: `${name} 様を台帳から削除しました。`,
      }),
    restored: (name: string) =>
      text({
        en: `${name} was brought back to the ledger.`,
        ja: `${name} 様を台帳に戻しました。`,
      }),
  },
  /** The page of a customer: the parts of the record */
  record: {
    title: text({ en: 'Ledger', ja: '台帳' }),
    book: text({ en: 'Book', ja: '予約を入れる' }),
    change: TITLES.change,
    createdAt: text({ en: 'Registered', ja: '登録日時' }),
    updatedAt: text({ en: 'Last changed', ja: '最後に直した日時' }),
    visits: {
      title: text({ en: 'Visits and points', ja: '来店とポイント' }),
      pointHistory: text({ en: 'Point history', ja: 'ポイントの履歴' }),
      firstVisit: text({ en: 'First visit', ja: '初回来店日' }),
      lastVisit: LAST_VISIT,
      none: NO_VISIT,
      visits: record.visits,
      visitsOf: record.visitsOf,
      noShows: text({ en: 'No-shows', ja: '無断キャンセル' }),
      noShowsOf: (count: number) => countOf(count, 'no-show', 'no-shows', '回'),
      cancellations: text({ en: 'Cancellations', ja: 'キャンセル' }),
      cancellationsOf: (count: number) =>
        countOf(count, 'cancellation', 'cancellations', '回'),
      points: record.points,
      pointsOf: record.pointsOf,
    },
    chart: {
      title: text({ en: 'Chart', ja: 'カルテ' }),
      open: text({ en: 'Open the chart', ja: 'カルテを見る' }),
      about: text({
        en: 'Conditions and health to check before a treatment, products to use and to avoid, and treatments received at other salons are written in the chart.',
        ja: '施術の前に確かめる持病や体調、好みの商材と避ける商材、ほかのサロンで受けた施術は、カルテに書きます。',
      }),
    },
  },
  /** The items of the record, as the page of a customer names them, and what they show */
  items: {
    name: record.parts.name,
    kana: record.kana,
    email: record.email,
    phoneNumber: record.phoneNumber,
    alternativePhone: record.alternativePhone,
    address: record.parts.address,
    birthDate: record.birthDate,
    gender: record.gender,
    occupation: record.occupation,
    hair: HAIR_AND_SCALP,
    preferredServices: record.preferredServices,
    preferenceNotes: PREFERENCE_NOTES,
    membershipTier: record.membershipTier,
    status: STATUS,
    active: text({ en: 'Active', ja: '有効' }),
    activeValue: text({ en: 'Active', ja: '有効' }),
    inactiveValue: text({
      en: 'Inactive (cannot book by themselves)',
      ja: '無効（ご自分では予約を入れられません）',
    }),
    tags: TAGS,
    referralCode: record.referralCode,
    notIssued: record.notIssued,
    referredBy: REFERRED_BY,
    contacts: CONTACTS,
    notes: NOTES,
    internalNotes: INTERNAL_NOTES,
    /** The entries of a list: 「カット、カラー」; what somebody wrote (a tag) stands as it is */
    listed: (entries: readonly (string | LocalizedText)[]) => listed(entries),
    /** The ways a customer may be reached, or that there is none */
    contactsOf: (ways: readonly LocalizedText[]) =>
      ways.length === 0
        ? text({ en: 'None allowed', ja: '受け取らない' })
        : listed(ways),
    byEmail: text({ en: 'Email', ja: 'メール' }),
    bySms: text({ en: 'SMS', ja: 'SMS' }),
    marketing: record.marketing,
    /** The hair and the scalp, what of them was recorded: 「ストレート、細い髪、頭皮は乾燥」 */
    hairOf: (
      hairType: LocalizedText | null,
      thickness: LocalizedText | null,
      scalp: LocalizedText | null,
    ): LocalizedText | null => {
      const parts = [
        hairType === null
          ? null
          : text({ en: `Type: ${hairType.en}`, ja: hairType.ja }),
        thickness === null
          ? null
          : text({ en: `Thickness: ${thickness.en}`, ja: `${thickness.ja}髪` }),
        scalp === null
          ? null
          : text({ en: `Scalp: ${scalp.en}`, ja: `頭皮は${scalp.ja}` }),
      ].filter((part) => part !== null)

      return parts.length === 0 ? null : joined(parts, { en: '; ', ja: '、' })
    },
    /**
     * Where a customer lives, as an envelope says it: 「〒150-0001
     * 東京都渋谷区神宮前 4-1-1 ハイツ 101」. The parts stand as they were
     * written; English puts a space between those of the street
     */
    addressOf: (
      postalCode: string | null,
      street: readonly string[],
      building: string | null,
    ): LocalizedText | null => {
      const parts = [
        ...(postalCode === null ? [] : [postalCodeOf(postalCode)]),
        ...(street.length === 0
          ? []
          : [text({ en: street.join(' '), ja: street.join('') })]),
        ...(building === null ? [] : [building]),
      ]

      return parts.length === 0 ? null : joined(parts, { en: ' ', ja: ' ' })
    },
  },
  /** The states of a customer in the ledger */
  statuses: {
    active: text({ en: 'Normal', ja: '通常' }),
    inactive: text({ en: 'Dormant', ja: '休眠' }),
    vip: text({ en: 'VIP', ja: 'VIP' }),
    blacklisted: text({ en: 'Suspended', ja: '利用停止' }),
  },
  /** What the customer did at the salon over a period */
  use: {
    title: text({ en: 'Use of this salon', ja: 'このサロンでの利用' }),
    treatments: text({
      en: 'View the treatment records',
      ja: '施術記録を見る',
    }),
    periodDescription: text({
      en: 'Up to 366 days can be counted.',
      ja: '366 日まで集計できます。',
    }),
    /** The period counted, said above the figures */
    of: (period: LocalizedText) =>
      text({ en: `Figures for ${period.en}`, ja: `${period.ja}の集計` }),
    counting: text({ en: 'Counting the visits', ja: '利用を集計しています' }),
    bookings: text({ en: 'Bookings', ja: '予約' }),
    bookingsOf: (count: number) => countOf(count, 'booking', 'bookings', '件'),
    spent: text({ en: 'Total spent', ja: '利用額' }),
    averagePerBooking: text({
      en: 'Average per booking',
      ja: '予約 1 件あたりの会計',
    }),
    lastVisit: text({ en: 'Last visit', ja: '最後の来店' }),
    cancellationRate: text({ en: 'Cancellation rate', ja: 'キャンセル率' }),
    noShowRate: text({ en: 'No-show rate', ja: '無断キャンセル率' }),
    favoriteServices: text({
      en: 'Most booked services',
      ja: 'よく受けたメニュー',
    }),
    service: text({ en: 'Service', ja: 'メニュー' }),
    favoriteStaff: text({
      en: 'Staff most often in charge',
      ja: 'よく担当したスタッフ',
    }),
    staff: text({ en: 'Staff', ja: 'スタッフ' }),
    noVisit: text({
      en: 'No bookings were completed in this period',
      ja: 'この期間に完了した予約はありません',
    }),
  },
  /** What the customer wants the salons to keep in mind */
  preferences: {
    title: text({ en: 'Preferences', ja: '好み設定' }),
    change: TITLES.preferences,
    loading: text({
      en: 'Loading the preferences',
      ja: '好み設定を読み込んでいます',
    }),
  },
  /** What a part says of a customer who was removed while the page was open */
  gone: GONE,
  /** Whether the customer signs in to the portal, for an administrator */
  account: {
    title: text({ en: 'Sign-in account', ja: 'ログインアカウント' }),
    open: text({ en: 'View the account', ja: 'アカウントの状態を見る' }),
    none: text({
      en: 'This customer has no portal account.',
      ja: 'このお客様は、ポータルのアカウントを持っていません。',
    }),
    some: text({
      en: 'This customer has an account to sign in to the portal. Unlocking it and resetting its two-factor authentication are done on the account screen.',
      ja: 'このお客様は、ポータルにログインするアカウントを持っています。ロックの解除と 2 要素認証のリセットは、アカウントの画面で行います。',
    }),
  },
  /** What is done with the record itself: the history, the merge and the removal */
  keeping: {
    title: text({ en: 'Record keeping', ja: '台帳の管理' }),
    about: text({
      en: 'Check who changed the record and when, merge two records of the same customer into one, and remove customers who no longer come from the ledger.',
      ja: '台帳をだれがいつ変えたかを確かめ、同じお客様の 2 つの記録を 1 つにまとめ、来なくなったお客様を台帳から削除します。',
    }),
    history: TITLES.history,
    merge: text({
      en: 'Merge with another customer',
      ja: 'ほかのお客様とまとめる',
    }),
    remove: text({ en: 'Remove from the ledger', ja: '台帳から削除する' }),
    confirm: (name: string) =>
      text({
        en: `Remove ${name} from the ledger?`,
        ja: `${name} 様を台帳から削除しますか？`,
      }),
    confirmDescription: text({
      en: 'The customer can no longer be chosen in the customer ledger and in bookings. Their bookings and sales are kept. They can be brought back to the ledger afterwards.',
      ja: '顧客台帳と予約で、このお客様を選べなくなります。予約と売上の記録は残ります。削除したあとも、台帳に戻せます。',
    }),
    back: uiMessages.back,
    confirmRemoval: text({ en: 'Remove', ja: '削除する' }),
    /** What a member of the staff is told where the ledger would be kept */
    keptByOthers: KEPT_BY_OTHERS,
  },
  /** What follows an attempt to take a customer out of the ledger */
  removal: {
    unfinished: text({
      en: 'The customer has bookings that are not finished, so they could not be removed. Complete, cancel or delete those bookings, then try again.',
      ja: '終わっていない予約があるため、削除できませんでした。予約を完了、キャンセル、または削除してから、もう一度お試しください。',
    }),
    forbidden: followed(
      text({
        en: 'This account cannot remove customers from the ledger.',
        ja: 'このアカウントでは、お客様を台帳から削除できません。',
      }),
      KEPT_BY_OTHERS,
    ),
    failed: text({
      en: 'The customer could not be removed from the ledger. Check your connection and try again.',
      ja: 'お客様を台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** What follows an attempt to bring a customer back to the ledger */
  restoration: {
    emailTaken: (email: string) =>
      text({
        en: `A customer registered after the removal uses this customer's email address (${email}). Change that customer's email address, then bring this one back to the ledger.`,
        ja: `このお客様のメールアドレス（${email}）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。`,
      }),
    /** The link of the refusal, to the customer who took the address */
    findThem: text({
      en: 'Find that customer in the ledger',
      ja: 'そのお客様を台帳で探す',
    }),
    forbidden: followed(
      text({
        en: 'This account cannot bring customers back to the ledger.',
        ja: 'このアカウントでは、お客様を台帳に戻せません。',
      }),
      KEPT_BY_OTHERS,
    ),
    failed: text({
      en: 'The customer could not be brought back to the ledger. Check your connection and try again.',
      ja: 'お客様を台帳に戻せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** A customer who left the ledger, as their latest version keeps them */
  removed: {
    /** When and by whom the customer left, and how; a version nobody made names nobody */
    done: (
      when: LocalizedText,
      changer: LocalizedText | null,
      removal: 'deleted' | 'merged' | 'erased',
    ) => {
      const done = {
        deleted: {
          en: 'removed this customer from the ledger',
          ja: '台帳から削除しました',
        },
        merged: {
          en: 'merged this customer into another',
          ja: 'ほかのお客様に統合しました',
        },
        erased: {
          en: 'erased this customer on a deletion request',
          ja: '削除の依頼で消去しました',
        },
      }[removal]

      return changer === null
        ? text({
            en: `Somebody ${done.en} on ${when.en}.`,
            ja: `${when.ja} に、${done.ja}。`,
          })
        : text({
            en: `${changer.en} ${done.en} on ${when.en}.`,
            ja: `${when.ja} に、${changer.ja}が${done.ja}。`,
          })
    },
    merged: text({
      en: 'This customer was merged into another, so they cannot be brought back to the ledger.',
      ja: 'ほかのお客様に統合されたため、台帳に戻せません。',
    }),
    erased: text({
      en: 'This customer was erased on a deletion request, so they cannot be brought back to the ledger.',
      ja: '削除の依頼で消去されたため、台帳に戻せません。',
    }),
    restore: text({ en: 'Bring back to the ledger', ja: '台帳に戻す' }),
    history: TITLES.history,
    recordTitle: text({
      en: 'The record when removed',
      ja: '削除されたときの台帳',
    }),
    /** A customer who came back while the page was read */
    restoredMeanwhile: text({
      en: 'This customer was brought back to the ledger in the meantime. Load the page again.',
      ja: 'このお客様は、その間に台帳に戻されました。読み込み直してください。',
    }),
  },
  /** The versions of a customer */
  history: {
    caption: text({ en: 'Versions', ja: '版の一覧' }),
    version: text({ en: 'Version', ja: '版' }),
    versionOf: (version: number) =>
      text({ en: `Version ${version}`, ja: `版 ${version}` }),
    operation: text({ en: 'Operation', ja: '操作' }),
    changedAt: text({ en: 'Date and time', ja: '日時' }),
    changedBy: text({ en: 'Changed by', ja: '変更者' }),
    changes: text({ en: 'Changed items', ja: '変えた項目' }),
    /**
     * The items a version changed, or that none was, for an update that
     * changed no value; a value the ledger does not know stands as the API
     * names it
     */
    changedItems: (terms: readonly (string | LocalizedText)[]) =>
      terms.length === 0 ? uiMessages.none : listed(terms),
    empty: text({ en: 'No versions', ja: '版はありません' }),
    loading: text({
      en: 'Loading the change history',
      ja: '変更履歴を読み込んでいます',
    }),
    /** What made a version, in a word */
    operations: {
      baseline: text({ en: 'Start of the record', ja: '記録の開始' }),
      create: text({ en: 'Registered', ja: '登録' }),
      update: text({ en: 'Updated', ja: '更新' }),
      delete: text({ en: 'Removed', ja: '削除' }),
      restore: text({ en: 'Restored', ja: '復元' }),
      merge: text({ en: 'Merged', ja: '統合' }),
      erase: text({ en: 'Erased', ja: '消去' }),
    },
    /** Who made a version, as far as the salon can tell */
    changers: {
      you: text({ en: 'You', ja: 'あなた' }),
      customer: text({ en: 'The customer', ja: 'お客様ご本人' }),
      another: text({ en: 'Another account', ja: 'ほかのアカウント' }),
    },
  },
  /** A version of a customer */
  version: {
    /** What made it, when and by whom, in one line: 「版 3・更新・…」 */
    line: (parts: readonly LocalizedText[]) =>
      joined(parts, { en: ' · ', ja: '・' }),
    unchanged: text({
      en: 'No value changed from the version before.',
      ja: '前の版から、値は変わっていません。',
    }),
    changedCaption: text({
      en: 'Items changed from the version before',
      ja: '前の版から変えた項目',
    }),
    item: text({ en: 'Item', ja: '項目' }),
    before: text({ en: 'Version before', ja: '前の版' }),
    after: text({ en: 'This version', ja: 'この版' }),
    noChangedItems: text({
      en: 'No items changed',
      ja: '変えた項目はありません',
    }),
    recordTitle: text({
      en: 'The record in this version',
      ja: 'この版の台帳',
    }),
    backToHistory: text({
      en: 'Back to the change history',
      ja: '変更履歴へ',
    }),
    loadingPrevious: text({
      en: 'Loading the version before',
      ja: '前の版を読み込んでいます',
    }),
    loading: text({ en: 'Loading the version', ja: '版を読み込んでいます' }),
    notFound: followed(
      text({
        en: 'There is no version of this number.',
        ja: 'この番号の版はありません。',
      }),
      CHECK_THE_ADDRESS,
    ),
  },
  /** What a screen of a customer says when there is none to show */
  notFound: {
    title: text({ en: 'Customer not found', ja: 'お客様が見つかりません' }),
    checkTheAddress: CHECK_THE_ADDRESS,
    removedNotShown: followed(
      CHECK_THE_ADDRESS,
      text({
        en: 'Customers removed from the ledger cannot be shown.',
        ja: '台帳から削除されたお客様は、表示できません。',
      }),
    ),
    toLedger: text({
      en: 'Back to the customer ledger',
      ja: '顧客台帳へ',
    }),
  },
  /** A screen of one customer while they are read */
  customer: {
    loading: text({
      en: 'Loading the customer',
      ja: 'お客様を読み込んでいます',
    }),
  },
  points: customerPointMessages,
  file: customerFileMessages,
  merge: customerMergeMessages,
  bulk: customerBulkMessages,
  exports: customerExportMessages,
  erasure: customerErasureMessages,
}
