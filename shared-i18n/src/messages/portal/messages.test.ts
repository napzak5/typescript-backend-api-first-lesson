import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { JAPANESE, messagesOf } from '../__tests__/found-messages'
import * as catalogues from './index'
import {
  portalAccountMessages,
  portalBookingMessages,
  portalProfileMessages,
  portalReviewMessages,
  portalSalonMessages,
  portalShareMessages,
} from './index'

const FOUND = messagesOf(catalogues, '')

const { invitation, passwordReset, verificationSent } = portalAccountMessages
const { booking, changes, detail, form, list, summary } = portalBookingMessages
const { about, hours, menu, results, reviews, searchForm, staff } =
  portalSalonMessages
const { details, email, membership } = portalProfileMessages
const { own, report } = portalReviewMessages
const reviewForm = portalReviewMessages.form
const { file } = portalShareMessages

/** An address of mail, which stands in every language as it is */
const EMAIL = 'hanako@example.com'

/** A day, a time and the length of a visit, as the formats write them */
const DAY = { en: 'Tue, November 24', ja: '11月24日（火）' }
const FULL_DAY = {
  en: 'Tuesday, November 24, 2026',
  ja: '2026年11月24日火曜日',
}
const HOURS = { en: '10:30–11:30', ja: '10:30〜11:30' }
const DURATION = { en: '1 hr 30 min', ja: '1 時間 30 分' }
const WHEN = {
  en: 'Tuesday, November 24, 2026, 10:30–11:30',
  ja: '2026年11月24日火曜日 10:30〜11:30',
}

/** The months of the hours of a week */
const PERIOD = {
  from: { en: 'Wed, April 1', ja: '4月1日（水）' },
  to: { en: 'Wed, September 30', ja: '9月30日（水）' },
}

/** An amount, as the formats write it */
const PRICE = { en: '¥5,500', ja: '￥5,500' }
const TAX = { en: '¥500', ja: '￥500' }

/** The level of a member of the staff, as the words of the business name it */
const LEVEL = { en: 'Senior stylist', ja: 'シニアスタイリスト' }

/** A review, as the buttons of the page of a salon name it */
const POSTED = {
  en: '“丁寧なカット” (posted Tue, November 24)',
  ja: '「丁寧なカット」（11月24日（火） 投稿）',
}

/** A day a review was posted on, as the formats write it */
const POSTED_ON = { en: 'November 10, 2026', ja: '2026年11月10日' }

/** A review of the customer, as the sentences of the reviews name it */
const SUBJECT = {
  en: 'Beauty Salon Tokyo (posted November 10, 2026)',
  ja: 'Beauty Salon Tokyo（2026年11月10日 投稿）',
}

/** Every message that is made from a value, with a value and what it then says. */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'portalAccountMessages.verificationSent.sentTo',
    verificationSent.sentTo(EMAIL),
    {
      en: 'We sent a confirmation mail to hanako@example.com. Open its link to finish the registration. The link works for 24 hours.',
      ja: 'hanako@example.com に、確認メールを送りました。メールのリンクを開くと、登録が完了します。リンクは 24 時間有効です。',
    },
  ],
  [
    'portalAccountMessages.passwordReset.sentTo',
    passwordReset.sentTo(EMAIL),
    {
      en: 'If hanako@example.com has an account, we sent it a mail to set a new password. Open the link of the mail and choose a new password. The link works for 30 minutes.',
      ja: 'hanako@example.com のアカウントがあれば、パスワードを再設定するためのメールを送りました。メールのリンクを開いて、新しいパスワードを決めてください。リンクは 30 分間有効です。',
    },
  ],
  [
    'portalAccountMessages.invitation.signInNotice',
    invitation.signInNotice(EMAIL),
    {
      en: 'This invitation is for the staff account of hanako@example.com. Sign in with that account.',
      ja: 'この招待は、hanako@example.com のスタッフのアカウントで受けられます。そのアカウントでサインインしてください。',
    },
  ],
  [
    'portalAccountMessages.invitation.notForThisAccount',
    invitation.notForThisAccount(EMAIL),
    {
      en: 'You cannot accept this invitation with the account you are signed in with. Sign in again with the staff account of hanako@example.com.',
      ja: 'サインインしているアカウントでは、この招待を受けられません。hanako@example.com のスタッフのアカウントでサインインし直してください。',
    },
  ],
  [
    'portalBookingMessages.booking.notOnline',
    booking.notOnline('Cut'),
    {
      en: '“Cut” cannot be booked on this screen. Please contact the salon to book it.',
      ja: '「Cut」は、この画面からは予約できません。ご予約は、サロンへお問い合わせください。',
    },
  ],
  [
    'portalBookingMessages.form.startTimeDescription',
    form.startTimeDescription(DAY),
    {
      en: 'The free times on Tue, November 24. The times are those of the time zone of the salon.',
      ja: '11月24日（火）の、空いている時刻です。時刻は、サロンのある地域の時刻です。',
    },
  ],
  [
    'portalBookingMessages.list.count',
    list.count(12),
    { en: '12 bookings', ja: '12 件の予約があります' },
  ],
  [
    'portalBookingMessages.summary.withDuration',
    summary.withDuration(HOURS, DURATION),
    { en: '10:30–11:30 (1 hr 30 min)', ja: '10:30〜11:30（1 時間 30 分）' },
  ],
  [
    'portalBookingMessages.summary.totalWithTax',
    summary.totalWithTax(PRICE, TAX),
    {
      en: '¥5,500 (including ¥500 consumption tax)',
      ja: '￥5,500（うち消費税 ￥500）',
    },
  ],
  [
    'portalBookingMessages.summary.whenLine',
    summary.whenLine(FULL_DAY, HOURS),
    WHEN,
  ],
  [
    'portalBookingMessages.detail.numbered',
    detail.numbered('B-20261124-0001'),
    { en: 'Booking number B-20261124-0001', ja: '予約番号 B-20261124-0001' },
  ],
  [
    'portalBookingMessages.changes.cancelDescription',
    changes.cancelDescription(WHEN),
    {
      en: 'This cancels the booking on Tuesday, November 24, 2026, 10:30–11:30. A cancelled booking cannot be restored.',
      ja: '2026年11月24日火曜日 10:30〜11:30の予約をキャンセルします。キャンセルした予約は、元に戻せません。',
    },
  ],
  [
    'portalSalonMessages.searchForm.atLeast',
    searchForm.atLeast(4),
    { en: '4.0 or higher', ja: '4.0 以上' },
  ],
  [
    'portalSalonMessages.results.found',
    results.found(12),
    { en: '12 salons found', ja: '12 件のサロンが見つかりました' },
  ],
  [
    'portalSalonMessages.results.featuresOf',
    results.featuresOf('Beauty Salon Tokyo'),
    {
      en: 'Features of Beauty Salon Tokyo',
      ja: 'Beauty Salon Tokyoの特徴',
    },
  ],
  [
    'portalSalonMessages.about.postalCode',
    about.postalCode('150-0001'),
    { en: '150-0001', ja: '〒150-0001' },
  ],
  [
    'portalSalonMessages.hours.ofTheWeek',
    hours.ofTheWeek(HOURS, null, null),
    HOURS,
  ],
  [
    'portalSalonMessages.menu.regularPrice',
    menu.regularPrice(PRICE),
    { en: 'Regularly ¥5,500', ja: '通常 ￥5,500' },
  ],
  [
    'portalSalonMessages.menu.orMore',
    menu.orMore(PRICE),
    { en: 'From ¥5,500', ja: '￥5,500〜' },
  ],
  [
    'portalSalonMessages.menu.tax',
    menu.tax(true),
    { en: '(tax included)', ja: '（税込）' },
  ],
  [
    'portalSalonMessages.menu.priceLine',
    menu.priceLine(PRICE, menu.tax(true)),
    { en: '¥5,500 (tax included)', ja: '￥5,500（税込）' },
  ],
  [
    'portalSalonMessages.menu.bookOf',
    menu.bookOf('Cut'),
    { en: 'Book Cut', ja: 'Cutを予約する' },
  ],
  [
    'portalSalonMessages.staff.role',
    staff.role('店長', LEVEL, 12),
    {
      en: '店長 · Senior stylist · 12 years of experience',
      ja: '店長・シニアスタイリスト・経験 12 年',
    },
  ],
  [
    'portalSalonMessages.staff.specialtiesOf',
    staff.specialtiesOf('田中 美咲'),
    { en: 'Specialties of 田中 美咲', ja: '田中 美咲の得意な施術' },
  ],
  [
    'portalSalonMessages.staff.certificationsOf',
    staff.certificationsOf('田中 美咲'),
    { en: 'Certifications of 田中 美咲', ja: '田中 美咲の資格' },
  ],
  [
    'portalSalonMessages.reviews.ratingOf',
    reviews.ratingOf(4),
    { en: '4 stars', ja: '評価 4' },
  ],
  [
    'portalSalonMessages.reviews.countOf',
    reviews.countOf(12),
    { en: '12 reviews', ja: '12 件' },
  ],
  [
    'portalSalonMessages.reviews.helpfulCount',
    reviews.helpfulCount(3),
    {
      en: '3 people found this helpful',
      ja: '3 人が「参考になった」と答えています',
    },
  ],
  [
    'portalSalonMessages.reviews.responseOn',
    reviews.responseOn(DAY),
    {
      en: 'Response from the salon (Tue, November 24)',
      ja: 'サロンからの返信（11月24日（火））',
    },
  ],
  [
    'portalSalonMessages.reviews.detailRatings',
    reviews.detailRatings([
      { label: reviews.sides.serviceRating, rating: 5 },
      { label: reviews.sides.valueRating, rating: 4 },
    ]),
    { en: 'Service 5 · Value 4', ja: 'サービス 5・価格 4' },
  ],
  [
    'portalSalonMessages.reviews.posted',
    reviews.posted('丁寧なカット', DAY),
    POSTED,
  ],
  [
    'portalSalonMessages.reviews.changeOf',
    reviews.changeOf(POSTED),
    {
      en: 'Change the review “丁寧なカット” (posted Tue, November 24)',
      ja: '「丁寧なカット」（11月24日（火） 投稿）のレビューを変更する',
    },
  ],
  [
    'portalSalonMessages.reviews.helpfulOf',
    reviews.helpfulOf(POSTED),
    {
      en: 'Helpful: the review “丁寧なカット” (posted Tue, November 24)',
      ja: '「丁寧なカット」（11月24日（火） 投稿）のレビューが参考になった',
    },
  ],
  [
    'portalSalonMessages.reviews.reportOf',
    reviews.reportOf(POSTED),
    {
      en: 'Report the review “丁寧なカット” (posted Tue, November 24)',
      ja: '「丁寧なカット」（11月24日（火） 投稿）のレビューを通報する',
    },
  ],
  [
    'portalProfileMessages.email.unchangeable',
    email.unchangeable(EMAIL),
    {
      en: 'Your email address (hanako@example.com) cannot be changed here. To change it, contact the salon.',
      ja: 'メールアドレス（hanako@example.com）は、ここでは変更できません。変更するときは、サロンにお問い合わせください。',
    },
  ],
  [
    'portalProfileMessages.details.postalCode',
    details.postalCode('150-0001'),
    { en: '150-0001', ja: '〒150-0001' },
  ],
  [
    'portalProfileMessages.details.listed',
    details.listed([details.byEmail, details.bySms]),
    {
      en: 'Messages by email, Messages by SMS',
      ja: 'メールでの連絡、SMS での連絡',
    },
  ],
  [
    'portalProfileMessages.membership.pointsOf',
    membership.pointsOf(2500),
    { en: '2,500 points', ja: '2,500 ポイント' },
  ],
  [
    'portalProfileMessages.membership.visitsOf',
    membership.visitsOf(12),
    { en: '12 visits', ja: '12 回' },
  ],
  [
    'portalReviewMessages.subject',
    portalReviewMessages.subject('Beauty Salon Tokyo', POSTED_ON),
    SUBJECT,
  ],
  [
    'portalReviewMessages.form.staffFixed',
    reviewForm.staffFixed('田中 ひろし'),
    {
      en: 'Staff rated: 田中 ひろし. The staff rated cannot be changed.',
      ja: '評価するスタッフ: 田中 ひろし。評価するスタッフは、変更できません。',
    },
  ],
  [
    'portalReviewMessages.form.titleDescription',
    reviewForm.titleDescription(255),
    {
      en: 'Up to 255 characters. You may leave it empty.',
      ja: '255 文字以内で書いてください。空欄のままでも、かまいません。',
    },
  ],
  [
    'portalReviewMessages.form.imagesDescription',
    reviewForm.imagesDescription(10),
    {
      en: 'Write the address of each picture on a line of its own, up to 10 pictures.',
      ja: '写真のアドレスを、1 行に 1 つずつ、10 個まで書けます。',
    },
  ],
  [
    'portalReviewMessages.form.tooManyImages',
    reviewForm.tooManyImages(10),
    {
      en: 'Add up to 10 pictures. Remove some lines.',
      ja: '画像は 10 個までです。行を減らしてください。',
    },
  ],
  [
    'portalReviewMessages.own.count',
    own.count(12),
    { en: '12 reviews', ja: '12 件のレビューがあります' },
  ],
  [
    'portalReviewMessages.own.ratedStaff',
    own.ratedStaff('田中 ひろし'),
    { en: 'Staff rated: 田中 ひろし', ja: '評価したスタッフ: 田中 ひろし' },
  ],
  [
    'portalReviewMessages.own.changeOf',
    own.changeOf(SUBJECT),
    {
      en: 'Change the review of Beauty Salon Tokyo (posted November 10, 2026)',
      ja: 'Beauty Salon Tokyo（2026年11月10日 投稿）のレビューを変更する',
    },
  ],
  [
    'portalReviewMessages.own.deleteOf',
    own.deleteOf(SUBJECT),
    {
      en: 'Delete the review of Beauty Salon Tokyo (posted November 10, 2026)',
      ja: 'Beauty Salon Tokyo（2026年11月10日 投稿）のレビューを削除する',
    },
  ],
  [
    'portalReviewMessages.own.deleteDescription',
    own.deleteDescription(SUBJECT),
    {
      en: 'This deletes your review of Beauty Salon Tokyo (posted November 10, 2026). A deleted review is gone for good, together with the reply of the salon. You can write a review of this visit again.',
      ja: 'Beauty Salon Tokyo（2026年11月10日 投稿）のレビューを削除します。削除したレビューは、サロンからの返信とともに消え、元に戻せません。この来店のレビューは、もう一度書けます。',
    },
  ],
  [
    'portalReviewMessages.report.description',
    report.description(POSTED),
    {
      en: 'This reports the review “丁寧なカット” (posted Tue, November 24) to the team that runs the site. The team checks it, and deletes a review that breaks the rules. Until then, the review stays listed.',
      ja: '「丁寧なカット」（11月24日（火） 投稿）のレビューを、運営に通報します。運営が内容を確かめ、規則に反するレビューは削除します。確かめが済むまで、レビューは掲載されたままです。',
    },
  ],
  [
    'portalReviewMessages.report.detailsDescription',
    report.detailsDescription(2000),
    {
      en: 'Say what the problem is, in up to 2,000 characters. When the reason is “Other”, this is required.',
      ja: 'どこが問題かを、2,000 文字以内でご記入ください。理由が「その他」のときは、必ずご記入ください。',
    },
  ],
  [
    'portalShareMessages.file.sizeOf',
    file.sizeOf(
      { en: '340 kB', ja: '340 KB' },
      { en: '348,160 bytes', ja: '348,160 バイト' },
    ),
    { en: '340 kB (348,160 bytes)', ja: '340 KB（348,160 バイト）' },
  ],
]

/** A name that stands inside a sentence of another catalogue: it begins as it stands there */
const INSIDE_A_SENTENCE = /\.names\./

/** A part of a sentence that has a link in it: the parts are joined, in their order, around the link */
const PART_OF_A_SENTENCE = /WithLinks?\.[^.]+$/

/** A rating of the form, which begins with the figure it names: 「5（とても満足）」 */
const FIGURE_FIRST = /\.form\.scale\./

/** What stands between the values of a list: punctuation, written in the way of each language */
const PUNCTUATION = ['portalSalonMessages.about.betweenPhoneNumbers']

/** A message that is written as a sentence of each language */
const isWrittenInEach = ([where]: [string, LocalizedText]): boolean =>
  !INSIDE_A_SENTENCE.test(where) &&
  !PART_OF_A_SENTENCE.test(where) &&
  !FIGURE_FIRST.test(where) &&
  !PUNCTUATION.includes(where)

/** The sentences that have a link in them, by where they are, with their parts joined */
const SENTENCES_WITH_LINKS: [string, LocalizedText][] = Object.entries(
  Object.groupBy(
    FOUND.texts.filter(([where]) => PART_OF_A_SENTENCE.test(where)),
    ([where]) => where.replace(/\.[^.]+$/, ''),
  ),
).map(([where, parts = []]) => [
  where,
  {
    en: parts.map(([, part]) => part.en).join(''),
    ja: parts.map(([, part]) => part.ja).join(''),
  },
])

describe('the messages of the portal', () => {
  it.each(FOUND.texts.filter(isWrittenInEach))(
    'should be written in each language: %s',
    (_where, written) => {
      // Assert
      // A text that stands after a name is in brackets, and begins inside them
      expect(written.en).toMatch(/^\(?[A-Z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(FOUND.texts.filter(([where]) => INSIDE_A_SENTENCE.test(where)))(
    'should be written in each language as it stands inside a sentence: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[a-z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(FOUND.texts.filter(([where]) => PART_OF_A_SENTENCE.test(where)))(
    'should write a part of a sentence with a link in each language: %s',
    (_where, written) => {
      // Assert
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(SENTENCES_WITH_LINKS)(
    'should make one sentence of each language of the parts around a link: %s',
    (_where, joined) => {
      // Assert
      expect(joined.en).toMatch(/^[A-Z].*\.$/)
      expect(joined.ja).toMatch(/。$/)
    },
  )

  it.each(FOUND.texts.filter(([where]) => FIGURE_FIRST.test(where)))(
    'should write a rating with the figure first, and its word in each language: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[1-5] \([a-z ]+\)$/)
      expect(written.ja).toMatch(/^[1-5]（.+）$/)
      expect(written.ja).toMatch(JAPANESE)
      expect(written.en.at(0)).toBe(written.ja.at(0))
    },
  )

  it.each(FOUND.texts.filter(([where]) => PUNCTUATION.includes(where)))(
    'should write punctuation in the way of each language: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^\P{L}+$/u)
      expect(written.ja).toMatch(/^\P{L}+$/u)
      expect(written.ja).not.toBe(written.en)
    },
  )

  it('should find every punctuation in the catalogues', () => {
    // Act
    const found = FOUND.texts
      .map(([where]) => where)
      .filter((where) => PUNCTUATION.includes(where))

    // Assert
    expect(found).toEqual(PUNCTUATION)
  })

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
      FOUND.made.toSorted(),
    )
  })

  it.each<[string, LocalizedText, LocalizedText]>([
    ['booking', list.count(1), { en: '1 booking', ja: '1 件の予約があります' }],
    [
      'salon',
      results.found(1),
      { en: '1 salon found', ja: '1 件のサロンが見つかりました' },
    ],
    ['star', reviews.ratingOf(1), { en: '1 star', ja: '評価 1' }],
    ['point', membership.pointsOf(1), { en: '1 point', ja: '1 ポイント' }],
    [
      'review of the customer',
      own.count(1),
      { en: '1 review', ja: '1 件のレビューがあります' },
    ],
    [
      'picture',
      reviewForm.tooManyImages(1),
      {
        en: 'Add up to 1 picture. Remove some lines.',
        ja: '画像は 1 個までです。行を減らしてください。',
      },
    ],
    ['visit', membership.visitsOf(1), { en: '1 visit', ja: '1 回' }],
    ['review', reviews.countOf(1), { en: '1 review', ja: '1 件' }],
    [
      'person who found a review helpful',
      reviews.helpfulCount(1),
      {
        en: '1 person found this helpful',
        ja: '1 人が「参考になった」と答えています',
      },
    ],
    [
      'year of experience',
      staff.role(null, LEVEL, 1),
      {
        en: 'Senior stylist · 1 year of experience',
        ja: 'シニアスタイリスト・経験 1 年',
      },
    ],
  ])(
    'should count one %s as one in English, and with the same word in Japanese',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it.each<[string, LocalizedText, LocalizedText]>([
    [
      'the bookings',
      list.count(1234),
      { en: '1,234 bookings', ja: '1,234 件の予約があります' },
    ],
    [
      'the salons',
      results.found(1234),
      { en: '1,234 salons found', ja: '1,234 件のサロンが見つかりました' },
    ],
    [
      'the reviews',
      reviews.countOf(1234),
      { en: '1,234 reviews', ja: '1,234 件' },
    ],
    [
      'the points',
      membership.pointsOf(1234567),
      { en: '1,234,567 points', ja: '1,234,567 ポイント' },
    ],
    [
      'the visits',
      membership.visitsOf(1024),
      { en: '1,024 visits', ja: '1,024 回' },
    ],
    [
      'the people who found a review helpful',
      reviews.helpfulCount(1234),
      {
        en: '1,234 people found this helpful',
        ja: '1,234 人が「参考になった」と答えています',
      },
    ],
    [
      'the years of experience',
      staff.role(null, LEVEL, 1234),
      {
        en: 'Senior stylist · 1,234 years of experience',
        ja: 'シニアスタイリスト・経験 1,234 年',
      },
    ],
  ])(
    'should write the numbers of %s with the format of numbers',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should write a rating that is asked for to one decimal', () => {
    // Act
    const made = searchForm.atLeast(3.5)

    // Assert
    expect(made).toEqual({ en: '3.5 or higher', ja: '3.5 以上' })
  })

  it('should say the length of a visit alone when its hours are not known', () => {
    // Act
    const made = summary.withDuration(null, DURATION)

    // Assert
    expect(made).toEqual({ en: '(1 hr 30 min)', ja: '（1 時間 30 分）' })
  })

  it('should say the hours of a week with the break and the months they are for', () => {
    // Act
    const made = hours.ofTheWeek(
      { en: '10:00–19:00', ja: '10:00〜19:00' },
      { en: '13:00–14:00', ja: '13:00〜14:00' },
      PERIOD,
    )

    // Assert
    expect(made).toEqual({
      en: '10:00–19:00 (break 13:00–14:00) (Wed, April 1 – Wed, September 30)',
      ja: '10:00〜19:00（休憩 13:00〜14:00）（4月1日（水）〜9月30日（水））',
    })
  })

  it('should say the months of the hours of a week without a break', () => {
    // Act
    const made = hours.ofTheWeek(HOURS, null, PERIOD)

    // Assert
    expect(made).toEqual({
      en: '10:30–11:30 (Wed, April 1 – Wed, September 30)',
      ja: '10:30〜11:30（4月1日（水）〜9月30日（水））',
    })
  })

  it('should say that a price is without the tax', () => {
    // Act
    const made = menu.tax(false)

    // Assert
    expect(made).toEqual({ en: '(plus tax)', ja: '（税別）' })
  })

  it('should name the level alone of a member of the staff who says no more', () => {
    // Act
    const made = staff.role(null, LEVEL, null)

    // Assert
    expect(made).toEqual(LEVEL)
  })

  it('should name a review without a title by its day', () => {
    // Act
    const made = reviews.posted(null, DAY)

    // Assert
    expect(made).toEqual({
      en: 'posted Tue, November 24',
      ja: '11月24日（火） 投稿',
    })
  })
})
