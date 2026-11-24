import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { reviewMessages } from '../ui/reviews'
import { countedIn, joined, postalCodeOf } from '../written'

/** The mark between the parts of a line of short values: 「・」 */
const BETWEEN_VALUES = { en: ' · ', ja: '・' }

/**
 * What the screens of the salons in the portal say: the search, the page of
 * a salon with its parts (about the salon, the hours, the menu, the staff,
 * the reviews), and the components they show. What a salon wrote (its name,
 * the names of its services, its features) is shown as it was written.
 */
export const portalSalonMessages = {
  /** The search for a salon */
  search: {
    title: text({ en: 'Find a salon', ja: 'サロンを探す' }),
    description: text({
      en: 'Find a salon and see its hours, menu, staff and reviews.',
      ja: 'サロンを探して、営業時間、メニュー、スタッフ、レビューを見られます。',
    }),
    searching: text({ en: 'Looking for salons', ja: 'サロンを探しています' }),
    noMatch: text({
      en: 'No salon matches the conditions',
      ja: '条件に合うサロンが見つかりませんでした',
    }),
    noMatchDescription: text({
      en: 'Change the conditions and search again.',
      ja: '条件を変えて、もう一度お探しください。',
    }),
    noSalons: text({
      en: 'No salons are listed',
      ja: '掲載中のサロンはありません',
    }),
  },
  /** The controls of the search */
  searchForm: {
    prefecture: text({ en: 'Prefecture', ja: '都道府県' }),
    prefectureDescription: text({
      en: 'Written the same way as the salon registered it.',
      ja: 'サロンが登録した表記と同じもの（例: 東京都）',
    }),
    city: text({ en: 'City', ja: '市区町村' }),
    cityDescription: text({
      en: 'Written the same way as the salon registered it.',
      ja: 'サロンが登録した表記と同じもの（例: 渋谷区）',
    }),
    rating: text({ en: 'Rating', ja: '評価' }),
    anyRating: text({ en: 'Any', ja: '指定なし' }),
    /** The least rating a salon is to have: 「4.0 以上」 */
    atLeast: (rating: number) =>
      text({
        en: `${numberOf(rating, { most: 1, least: 1 }).en} or higher`,
        ja: `${numberOf(rating, { most: 1, least: 1 }).ja} 以上`,
      }),
    keyword: text({ en: 'Keyword', ja: 'キーワード' }),
    keywordDescription: text({
      en: 'A word in the name or the introduction of a salon',
      ja: 'サロンの名前か紹介文にある言葉',
    }),
  },
  /** The salons a search found */
  results: {
    title: text({ en: 'Results', ja: '検索結果' }),
    /** How many salons meet the conditions */
    found: (count: number) =>
      text({
        en: `${countedIn(count, 'salon', 'salons')} found`,
        ja: `${numberOf(count).ja} 件のサロンが見つかりました`,
      }),
    /** The features of a salon of the list, by its name */
    featuresOf: (name: string) =>
      text({ en: `Features of ${name}`, ja: `${name}の特徴` }),
  },
  /** The page of a salon */
  salon: {
    /** The title of the page that could not read the salon, and so not its name */
    title: text({ en: 'Salon details', ja: 'サロンの詳細' }),
    loading: text({ en: 'Loading the salon', ja: 'サロンを読み込んでいます' }),
    notFound: text({ en: 'Salon not found', ja: 'サロンが見つかりません' }),
    notFoundDescription: text({
      en: 'Check that the address is correct. The salon may no longer be listed.',
      ja: 'アドレスが正しいか、お確かめください。掲載を終えたサロンかもしれません。',
    }),
    noBookings: text({
      en: 'This salon is not taking bookings at the moment.',
      ja: 'このサロンは、現在、予約を受け付けていません。',
    }),
    about: text({ en: 'About the salon', ja: 'サロンについて' }),
    hours: text({ en: 'Hours', ja: '営業時間' }),
    menu: text({ en: 'Menu', ja: 'メニュー' }),
    staff: text({ en: 'Staff', ja: 'スタッフ' }),
    reviews: text({ en: 'Reviews', ja: 'レビュー' }),
  },
  /** What a salon says about itself, and how it is reached */
  about: {
    address: text({ en: 'Address', ja: '住所' }),
    /** The postal code of the address: 「〒150-0001」 */
    postalCode: postalCodeOf,
    phoneNumber: text({ en: 'Phone number', ja: '電話番号' }),
    /** What stands between the telephone numbers of a salon, which are links */
    betweenPhoneNumbers: text({ en: ', ', ja: '、' }),
    website: text({ en: 'Website', ja: 'ウェブサイト' }),
    features: text({ en: 'Features', ja: '特徴' }),
    amenities: text({ en: 'Amenities and services', ja: '設備とサービス' }),
  },
  /** When a salon is open */
  hours: {
    weekly: text({ en: 'Hours by day of the week', ja: '曜日ごとの営業時間' }),
    noWeekly: text({
      en: 'No hours by day of the week are registered.',
      ja: '曜日ごとの営業時間は、登録されていません。',
    }),
    dated: text({ en: 'Hours by date', ja: '日付ごとの営業時間' }),
    noDated: text({
      en: 'No hours are set for particular dates.',
      ja: '日付ごとに決めた営業時間は、ありません。',
    }),
    datedDescription: text({
      en: 'On the days below, the salon keeps these hours instead of those of the day of the week.',
      ja: '下の日は、曜日ごとの営業時間ではなく、このとおりに営業します。',
    }),
    /** A date of the calendar on which the salon does not open */
    closed: text({ en: 'Closed', ja: '休業' }),
    /** A day of the week on which the salon does not open */
    regularHoliday: text({ en: 'Closed', ja: '定休日' }),
    /**
     * The hours of a day of the week: from when until when, the breaks, and
     * the time they hold for, when they do for a time only
     */
    ofTheWeek: (
      open: LocalizedText,
      breaks: LocalizedText | null,
      period: { from: LocalizedText; to: LocalizedText } | null,
    ) =>
      text({
        en: [
          open.en,
          ...(breaks === null ? [] : [` (break ${breaks.en})`]),
          ...(period === null
            ? []
            : [` (${period.from.en} – ${period.to.en})`]),
        ].join(''),
        ja: [
          open.ja,
          ...(breaks === null ? [] : [`（休憩 ${breaks.ja}）`]),
          ...(period === null
            ? []
            : [`（${period.from.ja}〜${period.to.ja}）`]),
        ].join(''),
      }),
  },
  /** The menu of a salon */
  menu: {
    loading: text({ en: 'Loading the menu', ja: 'メニューを読み込んでいます' }),
    none: text({
      en: 'No services are listed',
      ja: '掲載中のメニューはありません',
    }),
    /** The part of the services without a category */
    unsorted: text({ en: 'Other', ja: 'その他' }),
    onConsultation: text({ en: 'Price on consultation', ja: '要相談' }),
    /** The price before a discount: 「通常 ￥6,000」 */
    regularPrice: (price: LocalizedText) =>
      text({ en: `Regularly ${price.en}`, ja: `通常 ${price.ja}` }),
    /** A price where it begins, which rises with what is done: 「￥8,000〜」 */
    orMore: (price: LocalizedText) =>
      text({ en: `From ${price.en}`, ja: `${price.ja}〜` }),
    /** Whether the price includes the consumption tax: 「（税込）」 */
    tax: (included: boolean) =>
      text({
        en: included ? '(tax included)' : '(plus tax)',
        ja: included ? '（税込）' : '（税別）',
      }),
    /** The price and its tax in one line: 「￥5,500（税込）」 */
    priceLine: (price: LocalizedText, tax: LocalizedText) =>
      text({ en: `${price.en} ${tax.en}`, ja: `${price.ja}${tax.ja}` }),
    consultationRequired: text({
      en: 'Consultation required',
      ja: '要カウンセリング',
    }),
    noOnlineBooking: text({
      en: 'No online booking',
      ja: 'オンライン予約不可',
    }),
    book: text({ en: 'Book', ja: '予約する' }),
    /** The link that books a service, named by the service it books */
    bookOf: (service: string) =>
      text({ en: `Book ${service}`, ja: `${service}を予約する` }),
  },
  /** The people of a salon */
  staff: {
    loading: text({
      en: 'Loading the staff',
      ja: 'スタッフを読み込んでいます',
    }),
    none: text({ en: 'No staff are listed', ja: '掲載中のスタッフはいません' }),
    /** What a person does at the salon, in one line: 「店長・シニア・経験 12 年」 */
    role: (
      position: string | null,
      level: LocalizedText,
      yearsOfExperience: number | null,
    ) =>
      joined(
        [
          ...(position === null ? [] : [position]),
          level,
          ...(yearsOfExperience === null
            ? []
            : [
                text({
                  en: `${countedIn(yearsOfExperience, 'year', 'years')} of experience`,
                  ja: `経験 ${numberOf(yearsOfExperience).ja} 年`,
                }),
              ]),
        ],
        BETWEEN_VALUES,
      ),
    specialties: text({ en: 'Specialties', ja: '得意な施術' }),
    specialtiesOf: (name: string) =>
      text({ en: `Specialties of ${name}`, ja: `${name}の得意な施術` }),
    certifications: text({ en: 'Certifications', ja: '資格' }),
    certificationsOf: (name: string) =>
      text({ en: `Certifications of ${name}`, ja: `${name}の資格` }),
    takesNoBookings: text({
      en: 'Takes no bookings',
      ja: '予約の受け付けなし',
    }),
  },
  /** The reviews of a salon */
  reviews: {
    loadingSummary: text({
      en: 'Loading the ratings',
      ja: '評価を読み込んでいます',
    }),
    loading: text({
      en: 'Loading the reviews',
      ja: 'レビューを読み込んでいます',
    }),
    noneYet: text({ en: 'No reviews yet', ja: 'レビューは、まだありません' }),
    /** How many readers found a review helpful */
    helpfulCount: (count: number) =>
      text({
        en: `${countedIn(count, 'person', 'people')} found this helpful`,
        ja: `${numberOf(count).ja} 人が「参考になった」と答えています`,
      }),
    /** The heading of the response, with the day the salon gave it */
    responseOn: (day: LocalizedText) =>
      text({
        en: `${reviewMessages.response.en} (${day.en})`,
        ja: `${reviewMessages.response.ja}（${day.ja}）`,
      }),
    /** The ratings of the sides of a visit, those the customer gave: 「サービス 5・スタッフ 4」 */
    detailRatings: (
      given: readonly { label: LocalizedText; rating: number }[],
    ) =>
      joined(
        given.map(({ label, rating }) =>
          text({
            en: `${label.en} ${numberOf(rating).en}`,
            ja: `${label.ja} ${numberOf(rating).ja}`,
          }),
        ),
        BETWEEN_VALUES,
      ),
    /**
     * Which review one is, as a button and a sentence name it: by its title
     * and the day it was posted, or by the day alone
     */
    posted: (title: string | null, day: LocalizedText) =>
      text({
        en:
          title === null ? `posted ${day.en}` : `“${title}” (posted ${day.en})`,
        ja:
          title === null ? `${day.ja} 投稿` : `「${title}」（${day.ja} 投稿）`,
      }),
    change: text({ en: 'Change the review', ja: 'レビューを変更する' }),
    changeOf: (posted: LocalizedText) =>
      text({
        en: `Change the review ${posted.en}`,
        ja: `${posted.ja}のレビューを変更する`,
      }),
    helpful: text({ en: 'Helpful', ja: '参考になった' }),
    helpfulOf: (posted: LocalizedText) =>
      text({
        en: `Helpful: the review ${posted.en}`,
        ja: `${posted.ja}のレビューが参考になった`,
      }),
    reportOf: (posted: LocalizedText) =>
      text({
        en: `Report the review ${posted.en}`,
        ja: `${posted.ja}のレビューを通報する`,
      }),
    /** What a visitor is told under the reviews, with the link to the sign-in */
    signInToActWithLink: {
      link: text({ en: 'Sign in', ja: 'サインイン' }),
      after: text({
        en: ' to say that a review was helpful, or to report one that is a problem.',
        ja: 'すると、レビューが参考になったと伝えたり、問題のあるレビューを通報したりできます。',
      }),
    },
    gone: text({
      en: 'This review had been deleted. The reviews are loaded again.',
      ja: 'このレビューは、削除されていました。レビューを読み込み直します。',
    }),
    saidHelpful: text({
      en: 'You said that the review was helpful.',
      ja: '「参考になった」と伝えました。',
    }),
    reported: text({
      en: 'You reported the review. The team that runs the site will check it, and the review stays listed until then.',
      ja: 'レビューを通報しました。運営が内容を確かめます。確かめが済むまで、レビューは掲載されたままです。',
    }),
  },
  /**
   * What the sentences of this catalogue and of another one speak of (what
   * was not read: `answerMessages.unread`), written as it stands inside
   * such a sentence
   */
  names: {
    salon: text({ en: 'the salon', ja: 'サロン' }),
    salons: text({ en: 'the salons', ja: 'サロン' }),
    menu: text({ en: 'the menu', ja: 'メニュー' }),
    staff: text({ en: 'the staff', ja: 'スタッフ' }),
    staffRatings: text({
      en: 'the ratings of the staff',
      ja: 'スタッフの評価',
    }),
    ratings: text({ en: 'the ratings', ja: '評価' }),
    reviews: text({ en: 'the reviews', ja: 'レビュー' }),
  },
}
