import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { fieldMessages } from '../ui/fields'
import { countedIn } from '../written'
import { portalBookingMessages } from './bookings'

const { characters } = fieldMessages

const NO_SALON = portalBookingMessages.list.noSalon
const NO_STAFF = text({
  en: 'Staff member (no longer listed)',
  ja: 'スタッフ（掲載を終えています）',
})
const CHANGE_THE_REVIEW = text({
  en: 'Change the review',
  ja: 'レビューを変更する',
})
const WRITE_A_REVIEW = text({ en: 'Write a review', ja: 'レビューを書く' })
const YOUR_REVIEWS = text({ en: 'Your reviews', ja: '自分のレビュー' })
const NOT_OF_A_GONE_SALON = text({
  en: 'A review of a salon that is no longer listed cannot be written.',
  ja: '掲載を終えたサロンのレビューは、書けません。',
})

/** The name of a member of the staff a review rates, or what stands for one whose salon no longer shows them */
const staffNameOf = (name: string | null): LocalizedText =>
  name === null ? NO_STAFF : text({ en: name, ja: name })

/**
 * What the screens of the reviews of a customer say in the portal: the
 * form that writes a review and changes one, the reviews of the customer
 * with the dialog that deletes one, the part of the page of a visit, and
 * the dialog in which a reader reports a review. A review is shown as the
 * page of a salon shows it (`portalSalonMessages.reviews`); what the
 * customer wrote, and the names of salons and of the staff, stand as they
 * were written.
 */
export const portalReviewMessages = {
  /** What stands where the name of a salon would, when it is no longer listed */
  noSalon: NO_SALON,
  /** What stands where the name of a member of the staff would, when their salon no longer shows them */
  noStaff: NO_STAFF,
  /**
   * What a review of the customer is of, as a sentence names it:
   * 「Beauty Salon Tokyo（2026年11月10日 投稿）」. `salon` is `null` when the
   * salon is no longer listed
   */
  subject: (salon: string | null, posted: LocalizedText) =>
    text({
      en: `${salon ?? NO_SALON.en} (posted ${posted.en})`,
      ja: `${salon ?? NO_SALON.ja}（${posted.ja} 投稿）`,
    }),
  /** The form that writes a review and changes one */
  form: {
    shownToAll: text({
      en: 'Reviews are shown on the page of the salon, and anybody can read them.',
      ja: 'レビューは、サロンのページに掲載され、誰でも読めます。',
    }),
    ratings: text({ en: 'Ratings', ja: '評価' }),
    overallRating: text({ en: 'Overall rating', ja: '総合の評価' }),
    /** The ratings there are, the best first, each with the word for it */
    scale: {
      verySatisfied: text({ en: '5 (very satisfied)', ja: '5（とても満足）' }),
      satisfied: text({ en: '4 (satisfied)', ja: '4（満足）' }),
      neutral: text({ en: '3 (neutral)', ja: '3（ふつう）' }),
      somewhatDissatisfied: text({
        en: '2 (somewhat dissatisfied)',
        ja: '2（やや不満）',
      }),
      dissatisfied: text({ en: '1 (dissatisfied)', ja: '1（不満）' }),
    },
    /** The first choice of a rating of a side of the visit, which gives none */
    notRated: text({ en: 'Not rated', ja: '評価しない' }),
    staff: text({ en: 'Staff to rate', ja: '評価するスタッフ' }),
    /** The first choice of the staff, which rates nobody */
    noStaffRated: text({
      en: 'Do not rate the staff',
      ja: 'スタッフを評価しない',
    }),
    staffDescription: text({
      en: 'The review also counts as one of the member of the staff you choose.',
      ja: '選んだスタッフへのレビューとしても、集計されます。',
    }),
    noStaffToRate: text({
      en: 'The member of the staff who served you is not listed on the page of the salon at the moment, so the staff cannot be rated.',
      ja: 'この来店を担当したスタッフは、いまサロンのページに掲載されていないため、スタッフの評価はできません。',
    }),
    /** Whom a review that is written rates, which cannot be changed; `null` when their salon no longer shows them */
    staffFixed: (name: string | null) =>
      text({
        en: `Staff rated: ${staffNameOf(name).en}. The staff rated cannot be changed.`,
        ja: `評価するスタッフ: ${staffNameOf(name).ja}。評価するスタッフは、変更できません。`,
      }),
    nobodyRated: text({
      en: 'This review does not rate the staff. The staff to rate cannot be added later.',
      ja: 'このレビューは、スタッフを評価していません。評価するスタッフは、あとから追加できません。',
    }),
    words: text({ en: 'Your impressions', ja: '感想' }),
    title: text({ en: 'Title', ja: 'タイトル' }),
    titleDescription: (most: number) =>
      text({
        en: `Up to ${characters(most).en}. You may leave it empty.`,
        ja: `${characters(most).ja}以内で書いてください。空欄のままでも、かまいません。`,
      }),
    comment: text({ en: 'Comment', ja: '本文' }),
    commentDescription: text({
      en: 'You may leave it empty.',
      ja: '空欄のままでも、かまいません。',
    }),
    images: text({ en: 'Picture URLs', ja: '写真の URL' }),
    imagesDescription: (most: number) =>
      text({
        en: `Write the address of each picture on a line of its own, up to ${countedIn(most, 'picture', 'pictures')}.`,
        ja: `写真のアドレスを、1 行に 1 つずつ、${numberOf(most).ja} 個まで書けます。`,
      }),
    overallRatingMissing: text({
      en: 'Choose an overall rating.',
      ja: '総合の評価を選んでください。',
    }),
    tooManyImages: (most: number) =>
      text({
        en: `Add up to ${countedIn(most, 'picture', 'pictures')}. Remove some lines.`,
        ja: `画像は ${numberOf(most).ja} 個までです。行を減らしてください。`,
      }),
    staffGone: text({
      en: 'This member of the staff can no longer be chosen. Choose another, or “Do not rate the staff”.',
      ja: 'このスタッフは、選べなくなりました。ほかのスタッフか、「スタッフを評価しない」を選んでください。',
    }),
    visitReadAgain: text({
      en: 'This review could not be posted. The visit was loaded again: please check it.',
      ja: 'このレビューは、投稿できませんでした。来店の内容を読み込み直しましたので、お確かめください。',
    }),
  },
  /** The screen that writes the review of a visit */
  write: {
    title: WRITE_A_REVIEW,
    signInNotice: text({
      en: 'Sign in to write a review.',
      ja: 'レビューを書くには、サインインしてください。',
    }),
    visit: text({ en: 'The visit to review', ja: 'レビューする来店' }),
    salon: text({ en: 'Salon', ja: 'サロン' }),
    when: text({ en: 'Date and time of the visit', ja: '来店日時' }),
    submit: text({ en: 'Post the review', ja: 'レビューを投稿する' }),
    posted: text({
      en: 'Your review was posted.',
      ja: 'レビューを投稿しました。',
    }),
    refused: text({
      en: 'This review could not be posted.',
      ja: 'このレビューは、投稿できませんでした。',
    }),
    loading: text({
      en: 'Loading the visit',
      ja: '来店の内容を読み込んでいます',
    }),
    notVisited: text({
      en: 'The visit of this booking has not taken place yet',
      ja: 'この予約は、まだ来店が済んでいません',
    }),
    notVisitedDescription: text({
      en: 'A review can be written of a booking whose visit took place.',
      ja: 'レビューは、来店が済んだ予約について書けます。',
    }),
    toBooking: text({ en: 'See the booking', ja: '予約の内容を見る' }),
    reviewed: text({
      en: 'This visit has a review already',
      ja: 'この来店のレビューは、投稿済みです',
    }),
    reviewedDescription: text({
      en: 'A visit has one review. You can change the review you posted.',
      ja: 'レビューは、来店 1 回につき 1 件です。投稿したレビューは、変更できます。',
    }),
    salonGone: text({
      en: 'This salon is no longer listed',
      ja: 'このサロンは、掲載を終えています',
    }),
    salonGoneDescription: NOT_OF_A_GONE_SALON,
    notFoundDescription: text({
      en: 'Check that the address is correct. A booking made with another account cannot be reviewed.',
      ja: 'アドレスが正しいか、お確かめください。ほかのアカウントで入れた予約のレビューは、書けません。',
    }),
  },
  /** The screen that changes a review */
  change: {
    title: CHANGE_THE_REVIEW,
    signInNotice: text({
      en: 'Sign in to change your review.',
      ja: 'レビューを変更するには、サインインしてください。',
    }),
    loading: text({
      en: 'Loading the review',
      ja: 'レビューを読み込んでいます',
    }),
    reviewed: text({ en: 'The review to change', ja: '変更するレビュー' }),
    postedOn: text({ en: 'Posted on', ja: '投稿日' }),
    back: text({ en: 'Back to your reviews', ja: '自分のレビューへ戻る' }),
    changed: text({
      en: 'Your review was changed.',
      ja: 'レビューを変更しました。',
    }),
    gone: text({
      en: 'This review had been deleted already, so the changes could not be saved.',
      ja: 'このレビューは、すでに削除されていたため、変更を保存できませんでした。',
    }),
    notFound: text({ en: 'Review not found', ja: 'レビューが見つかりません' }),
    notFoundDescription: text({
      en: 'Check that the address is correct. A review written with another account cannot be changed.',
      ja: 'アドレスが正しいか、お確かめください。ほかのアカウントで書いたレビューは、変更できません。',
    }),
  },
  /** The reviews the customer wrote, and the dialog that deletes one */
  own: {
    title: YOUR_REVIEWS,
    description: text({
      en: 'The reviews you wrote of the salons you visited. They are shown on the pages of the salons, and anybody can read them.',
      ja: '来店したサロンに書いたレビューです。サロンのページに掲載され、誰でも読めます。',
    }),
    signInNotice: text({
      en: 'Sign in to see your reviews.',
      ja: '自分のレビューを見るには、サインインしてください。',
    }),
    loading: text({
      en: 'Loading your reviews',
      ja: 'レビューを読み込んでいます',
    }),
    none: text({ en: 'No reviews yet', ja: 'レビューは、まだありません' }),
    noneDescription: text({
      en: 'You can write a review from the page of a booking whose visit took place.',
      ja: '来店が済んだ予約の内容の画面から、レビューを書けます。',
    }),
    toPastBookings: text({
      en: 'See your past bookings',
      ja: 'これまでの予約を見る',
    }),
    withoutProfile: text({
      en: 'You can write reviews once your details are registered',
      ja: 'レビューは、お客様の情報を登録すると書けます',
    }),
    withoutProfileDescription: text({
      en: 'Register your name and phone number, and after a visit to a salon you can write a review of it.',
      ja: 'お名前と電話番号を登録して、サロンに来店すると、その来店のレビューを書けます。',
    }),
    /** How many reviews the list has */
    count: (count: number) =>
      text({
        en: countedIn(count, 'review', 'reviews'),
        ja: `${numberOf(count).ja} 件のレビューがあります`,
      }),
    /** Whom a review rates; `null` when their salon no longer shows them */
    ratedStaff: (name: string | null) =>
      text({
        en: `Staff rated: ${staffNameOf(name).en}`,
        ja: `評価したスタッフ: ${staffNameOf(name).ja}`,
      }),
    change: text({ en: 'Change', ja: '変更する' }),
    changeOf: (subject: LocalizedText) =>
      text({
        en: `Change the review of ${subject.en}`,
        ja: `${subject.ja}のレビューを変更する`,
      }),
    delete: text({ en: 'Delete', ja: '削除する' }),
    deleteOf: (subject: LocalizedText) =>
      text({
        en: `Delete the review of ${subject.en}`,
        ja: `${subject.ja}のレビューを削除する`,
      }),
    deleteTitle: text({
      en: 'Delete the review?',
      ja: 'レビューを削除しますか？',
    }),
    /** What the dialog says of the review it deletes */
    deleteDescription: (subject: LocalizedText) =>
      text({
        en: `This deletes your review of ${subject.en}. A deleted review is gone for good, together with the reply of the salon. You can write a review of this visit again.`,
        ja: `${subject.ja}のレビューを削除します。削除したレビューは、サロンからの返信とともに消え、元に戻せません。この来店のレビューは、もう一度書けます。`,
      }),
    deleted: text({
      en: 'Your review was deleted.',
      ja: 'レビューを削除しました。',
    }),
  },
  /** The part of the page of a visit that took place */
  ofBooking: {
    title: text({ en: 'Review', ja: 'レビュー' }),
    salonGone: NOT_OF_A_GONE_SALON,
    loading: text({
      en: 'Loading the review',
      ja: 'レビューを読み込んでいます',
    }),
    change: CHANGE_THE_REVIEW,
    none: text({
      en: 'No review of this visit has been written yet.',
      ja: 'この来店のレビューは、まだ書かれていません。',
    }),
    write: WRITE_A_REVIEW,
  },
  /** The dialog in which a reader of the page of a salon reports a review to the team that runs the site */
  report: {
    title: text({ en: 'Report the review', ja: 'レビューを通報する' }),
    /** What the dialog says of the review it reports, named as the page of the salon names it */
    description: (posted: LocalizedText) =>
      text({
        en: `This reports the review ${posted.en} to the team that runs the site. The team checks it, and deletes a review that breaks the rules. Until then, the review stays listed.`,
        ja: `${posted.ja}のレビューを、運営に通報します。運営が内容を確かめ、規則に反するレビューは削除します。確かめが済むまで、レビューは掲載されたままです。`,
      }),
    reason: text({ en: 'Reason for the report', ja: '通報の理由' }),
    details: text({ en: 'Details', ja: '詳しい内容' }),
    detailsDescription: (most: number) =>
      text({
        en: `Say what the problem is, in up to ${characters(most).en}. When the reason is “Other”, this is required.`,
        ja: `どこが問題かを、${characters(most).ja}以内でご記入ください。理由が「その他」のときは、必ずご記入ください。`,
      }),
    reportedBefore: text({
      en: 'You have reported this review already. A review can be reported once.',
      ja: 'このレビューは、すでに通報しています。1 つのレビューを通報できるのは、1 回です。',
    }),
    reasonMissing: text({
      en: 'Choose the reason for the report.',
      ja: '通報の理由を選んでください。',
    }),
    detailsMissing: text({
      en: 'When you choose “Other”, say what the problem is.',
      ja: '「その他」を選んだときは、何が問題かを入力してください。',
    }),
    unacceptable: text({
      en: 'This cannot be sent. Enter it again.',
      ja: 'この内容は送信できません。入力し直してください。',
    }),
  },
  /** The names that the sentences of other catalogues put in theirs (what was not read) */
  names: {
    review: text({ en: 'the review', ja: 'レビュー' }),
    reviews: text({ en: 'your reviews', ja: 'レビュー' }),
    visit: text({ en: 'the visit', ja: '来店の内容' }),
  },
}
