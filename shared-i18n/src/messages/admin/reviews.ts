import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { fieldMessages } from '../ui/fields'
import { termMessages } from '../ui/terms'
import { countOf } from '../written'
import { reviewAnswers } from './review-answers'
import { REVIEW_WORDS } from './review-words'

/*
 * What the admin application says of the reviews of a salon: what they
 * come to, the list and its filter, a review, the answer of the salon, the
 * report of a review to the team that runs the site, and what each role
 * may do. The words the portal says alike are those of `reviewMessages`.
 * The titles, the comments, the answers and the names of the customers and
 * of the staff stand as they were written.
 */

const OTHER = termMessages.reviewReportReason.other

export const adminReviewMessages = {
  titles: {
    reviews: REVIEW_WORDS.reviews,
    review: REVIEW_WORDS.review,
    response: text({ en: 'Respond to the review', ja: 'レビューに返信する' }),
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    summary: text({ en: 'the summary of the ratings', ja: '評価のまとめ' }),
    reviews: text({ en: 'the reviews', ja: 'レビュー' }),
    review: text({ en: 'the review', ja: 'レビュー' }),
  },
  loading: {
    summary: text({
      en: 'Loading the summary of the ratings',
      ja: '評価のまとめを読み込んでいます',
    }),
    reviews: text({
      en: 'Loading the reviews',
      ja: 'レビューを読み込んでいます',
    }),
    review: text({
      en: 'Loading the review',
      ja: 'レビューを読み込んでいます',
    }),
  },
  words: REVIEW_WORDS,
  /** A review by its title, which stands in every language as it was written */
  titled: (title: string) => text({ en: title, ja: title }),
  /** A review without a title, by its overall rating: 「評価 4 のレビュー」 */
  ratedOf: (rating: number) =>
    text({
      en: `Review rated ${numberOf(rating).en}`,
      ja: `評価 ${numberOf(rating).ja} のレビュー`,
    }),
  summary: {
    title: text({ en: 'Summary of the ratings', ja: '評価のまとめ' }),
  },
  /** The list of the reviews, and its filter */
  list: {
    toReports: text({ en: 'See the reports', ja: '通報を見る' }),
    filter: text({ en: 'Filter the reviews', ja: 'レビューを絞り込む' }),
    lowest: text({ en: 'Lowest rating', ja: '評価の下限' }),
    highest: text({ en: 'Highest rating', ja: '評価の上限' }),
    anyRating: text({ en: 'Any', ja: '指定しない' }),
    allStaff: text({ en: 'All', ja: 'すべて' }),
    rangeReversed: text({
      en: 'Make the highest rating the same as the lowest, or higher.',
      ja: '評価の上限は、下限と同じか、それより高くしてください。',
    }),
    caption: REVIEW_WORDS.reviews,
    narrowedCaption: text({
      en: 'Reviews matching the filters',
      ja: '条件に合うレビュー',
    }),
    none: text({ en: 'No reviews', ja: 'レビューはありません' }),
    noneDescription: text({
      en: 'Customers write reviews on the portal after their visits. The reviews that come in are listed here.',
      ja: 'お客様は、来店のあとに、ポータルからレビューを書けます。届いたレビューは、ここに並びます。',
    }),
    noneMatching: text({
      en: 'No reviews match the filters',
      ja: '条件に合うレビューはありません',
    }),
    noneMatchingDescription: text({
      en: 'Change the range of the ratings or the staff member, and search again.',
      ja: '評価の範囲やスタッフを変えて探してください。',
    }),
    postedOn: text({ en: 'Posted', ja: '投稿日' }),
    reports: text({ en: 'Reports', ja: '通報' }),
    unanswered: text({ en: 'No response', ja: '未返信' }),
    answered: text({ en: 'Responded', ja: '返信済み' }),
    /** The reports of a review that wait for the team that runs the site: 「未処理 2 件」 */
    pendingReportsOf: (count: number) =>
      text({
        en: `${numberOf(count).en} pending`,
        ja: `未処理 ${numberOf(count).ja} 件`,
      }),
  },
  /** A review as the screen of one shows it */
  record: {
    /** The rating of a side of the visit: 「サービスの評価」 */
    sideRatingOf: (side: LocalizedText) =>
      text({ en: `${side.en} rating`, ja: `${side.ja}の評価` }),
    customer: text({ en: 'Customer', ja: 'お客様' }),
    /** The customer who wrote the review could not be read */
    unreadCustomer: text({
      en: 'Could not be loaded',
      ja: '読み込めませんでした',
    }),
    booking: text({ en: 'Booking', ja: '予約' }),
    visit: text({ en: 'Booking of the visit', ja: '来店の予約' }),
    postedAt: text({ en: 'Posted', ja: '投稿日時' }),
    changedAt: text({ en: 'Edited', ja: '修正日時' }),
    helpful: text({ en: 'Found helpful by', ja: '参考になった' }),
    /** How many readers found the review helpful: 「2 人」 */
    peopleOf: (count: number) => countOf(count, 'person', 'people', '人'),
    pendingReports: text({ en: 'Pending reports', ja: '未処理の通報' }),
    /** How many reports wait: 「2 件」 */
    reportsOf: (count: number) => countOf(count, 'report', 'reports', '件'),
  },
  /** The report of a review to the team that runs the site, by the owner or a manager */
  report: {
    title: text({
      en: 'Report to the team that runs the site',
      ja: '運営への通報',
    }),
    explanation: text({
      en: 'Tell the team that runs the site about a review that breaks its rules, such as one with untrue statements or personal information. A salon cannot delete a review: the team checks it, and deletes a review that breaks the rules. A review can be reported once.',
      ja: '事実と違う内容や個人情報など、規則に反するレビューを運営に知らせます。サロンは、レビューを削除できません。運営が内容を確かめ、規則に反するレビューは削除します。通報は、1 つのレビューに 1 回です。',
    }),
    description: text({
      en: 'This reports the review to the team that runs the site. Only the team reads the report: the customer who wrote the review is not told. Until the team has checked it, the review stays listed.',
      ja: 'このレビューを、運営に通報します。通報の内容を読むのは運営だけで、レビューを書いたお客様には伝わりません。確かめが済むまで、レビューは掲載されたままです。',
    }),
    detailsDescription: (most: number) =>
      text({
        en: `Say how the review breaks the rules, in up to ${fieldMessages.characters(most).en}. When the reason is “${OTHER.en}”, this is required.`,
        ja: `どこが規則に反するかを、${fieldMessages.characters(most).ja}以内で書いてください。理由が「${OTHER.ja}」のときは、必ず書いてください。`,
      }),
    reportedBefore: text({
      en: 'This account has reported this review already. A review can be reported once. Please wait until the team that runs the site has checked it.',
      ja: 'このアカウントでは、このレビューをもう通報しています。通報は、1 つのレビューに 1 回です。運営が確かめるまで、お待ちください。',
    }),
    done: text({
      en: 'Reported the review. The team that runs the site will check it.',
      ja: '通報しました。運営が内容を確かめます。',
    }),
    forbidden: text({
      en: 'This account cannot report this review. Only the owners and managers of the salon can report a review.',
      ja: 'このアカウントでは、このレビューを通報できません。通報できるのは、サロンのオーナーとマネージャーです。',
    }),
    failed: text({
      en: 'Could not send the report. Check your connection and try again.',
      ja: '通報を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** Why a review offers a role no operation, or only some */
  notes: {
    admin: text({
      en: 'An administrator can withdraw a response that breaks the terms. The owners and managers of the salon write the responses and report reviews to the team that runs the site.',
      ja: '管理者は、規約に反する返信を取り下げられます。返信を書くことと、運営への通報は、サロンのオーナーとマネージャーがします。',
    }),
    others: text({
      en: 'Only the owners and managers of the salon can write responses and report reviews to the team that runs the site.',
      ja: '返信を書くことと、運営への通報ができるのは、サロンのオーナーとマネージャーです。',
    }),
  },
  /** A screen of a review when there is none to show */
  notFound: {
    title: text({ en: 'Review not found', ja: 'レビューが見つかりません' }),
    description: text({
      en: 'Check that the address is right. A review deleted by its customer or by the team that runs the site cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。お客様が削除したレビューと、運営が削除したレビューは、表示できません。',
    }),
  },
  ...reviewAnswers,
}
