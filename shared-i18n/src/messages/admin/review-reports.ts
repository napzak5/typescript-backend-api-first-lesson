import { type LocalizedText, text } from '../../languages/localized-text'
import { REVIEW_WORDS } from './review-words'

/*
 * What the admin application says of the reports of reviews, which an
 * administrator handles for the team that runs the site: the reports of
 * a salon and of a review, their dismissal, and the deletion of a review
 * that breaks the rules. The details of a report stand as they were
 * written.
 */

const PENDING = text({ en: 'Pending', ja: '未処理' })
const DISMISSED = text({ en: 'Dismissed', ja: '却下' })
const DISMISS = text({ en: 'Dismiss', ja: '却下する' })
const REMOVAL = text({ en: 'Deleting the review', ja: 'レビューの削除' })

/** Where the reports that come in are listed */
const LISTED_AS_THEY_COME = text({
  en: 'When a customer or a salon reports a review, the report is listed here, the first received first.',
  ja: 'お客様やサロンがレビューを通報すると、ここに、届いた順に並びます。',
})

export const adminReviewReportMessages = {
  title: text({ en: 'Reports of reviews', ja: 'レビューへの通報' }),
  /** What a screen could not read, as a sentence names it */
  names: {
    reports: text({ en: 'the reports', ja: '通報' }),
  },
  loading: text({ en: 'Loading the reports', ja: '通報を読み込んでいます' }),
  /** What an account that handles no reports is told */
  handlersOnly: text({
    en: 'This account cannot handle reports. Administrators check the reports, and dismiss them or delete the review.',
    ja: 'このアカウントでは、通報を扱えません。通報を確かめて、却下するか、レビューを削除するのは、管理者です。',
  }),
  explanation: text({
    en: 'The reports of the reviews of this salon, from customers and salons. Open a review: dismiss its reports when it breaks no rule, and delete it when it does.',
    ja: 'お客様とサロンから届いた、このサロンのレビューへの通報です。レビューを開いて、規則に反していなければ通報を却下し、反していればレビューを削除します。',
  }),
  toReviews: REVIEW_WORDS.toReviews,
  /** The reports a list shows */
  shown: {
    pending: PENDING,
    dismissed: DISMISSED,
    all: text({ en: 'All', ja: 'すべて' }),
  },
  filter: {
    label: text({ en: 'Filter the reports', ja: '通報を絞り込む' }),
    status: text({ en: 'Status', ja: '状態' }),
  },
  /** What the list of the reports shown is called, and what is said when there are none */
  lists: {
    pending: {
      caption: text({ en: 'Pending reports', ja: '未処理の通報' }),
      none: text({ en: 'No pending reports', ja: '未処理の通報はありません' }),
      description: LISTED_AS_THEY_COME,
    },
    dismissed: {
      caption: text({ en: 'Dismissed reports', ja: '却下した通報' }),
      none: text({
        en: 'No dismissed reports',
        ja: '却下した通報はありません',
      }),
      description: text({
        en: 'Dismissed reports are listed here, the first received first.',
        ja: '却下した通報は、ここに、届いた順に並びます。',
      }),
    },
    all: {
      caption: text({ en: 'Reports', ja: '通報' }),
      none: text({
        en: 'No reports of the reviews of this salon',
        ja: 'このサロンのレビューへの通報はありません',
      }),
      description: LISTED_AS_THEY_COME,
    },
  },
  /** The review of a report, as its row names it while it is not read by its title */
  reviewNames: {
    loading: text({
      en: 'Review (loading)',
      ja: 'レビュー（読み込んでいます）',
    }),
    removed: text({ en: 'Deleted review', ja: '削除されたレビュー' }),
    unread: text({
      en: 'Review (the title could not be loaded)',
      ja: 'レビュー（題名を読めませんでした）',
    }),
  },
  table: {
    receivedAt: text({ en: 'Received', ja: '受け付けた日時' }),
    review: REVIEW_WORDS.review,
    reason: text({ en: 'Reason', ja: '理由' }),
    status: text({ en: 'Status', ja: '状態' }),
    dismissal: text({ en: 'Dismissal', ja: '却下' }),
    dismiss: DISMISS,
    /** The button of the dismissal of a report, by when it was received */
    dismissOf: (received: LocalizedText) =>
      text({
        en: `Dismiss the report received on ${received.en}`,
        ja: `${received.ja}に受け付けた通報を却下する`,
      }),
    done: text({ en: 'Done', ja: '済み' }),
    none: text({ en: 'No reports', ja: '通報はありません' }),
    pending: PENDING,
    dismissed: DISMISSED,
    /** When a report was dismissed: 「2026年11月21日（土） 14:05に却下」 */
    dismissedAt: (moment: LocalizedText) =>
      text({ en: `Dismissed on ${moment.en}`, ja: `${moment.ja}に却下` }),
  },
  /** The reports of one review */
  ofReview: {
    title: text({ en: 'Reports', ja: '通報' }),
    explanation: text({
      en: `The reports of this review, from customers and salons. When the review breaks no rule, dismiss them. When it does, delete it under “${REMOVAL.en}”.`,
      ja: `お客様とサロンから届いた、このレビューへの通報です。レビューが規則に反していなければ、通報を却下します。反していれば、「${REMOVAL.ja}」から、レビューを削除します。`,
    }),
    none: text({
      en: 'No reports of this review.',
      ja: 'このレビューへの通報はありません。',
    }),
    caption: text({ en: 'Reports of this review', ja: 'このレビューへの通報' }),
  },
  /** The dismissal of a report, after a dialog */
  dismissal: {
    confirm: text({ en: 'Dismiss the report?', ja: '通報を却下しますか？' }),
    /** What the dialog says of the report, by when it was received */
    description: (received: LocalizedText) =>
      text({
        en: `This dismisses the report received on ${received.en}. A dismissed report is no longer pending, and the review stays listed as it is. A dismissal cannot be undone.`,
        ja: `${received.ja}に受け付けた通報を却下します。却下した通報は未処理の通報から外れ、レビューは、そのまま掲載されます。却下は、取り消せません。`,
      }),
    submit: DISMISS,
    done: text({ en: 'Dismissed the report.', ja: '通報を却下しました。' }),
    already: text({
      en: 'Meanwhile, another administrator dismissed this report. A report is dismissed once.',
      ja: 'この通報は、その間に、ほかの管理者が却下しました。却下は、1 つの通報に 1 回です。',
    }),
    failed: text({
      en: 'Could not dismiss the report. Check your connection and try again.',
      ja: '通報を却下できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The deletion of a review that breaks the rules, after a dialog */
  removal: {
    title: REMOVAL,
    explanation: text({
      en: 'Delete a review that breaks the rules. A deleted review is gone from the screens of the customers and of the salon, with its reports. It cannot be brought back.',
      ja: '規則に反するレビューを削除します。削除すると、お客様の画面とサロンの画面から消え、このレビューへの通報も消えます。削除したレビューは、元に戻せません。',
    }),
    open: text({ en: 'Delete the review', ja: 'レビューを削除する' }),
    /** The dialog, by the name of the review */
    confirm: (review: LocalizedText) =>
      text({
        en: `Delete “${review.en}”?`,
        ja: `「${review.ja}」を削除しますか？`,
      }),
    description: text({
      en: 'A deleted review cannot be brought back. Its reports go with it.',
      ja: '削除したレビューは、元に戻せません。このレビューへの通報も、一緒に消えます。',
    }),
    submit: text({ en: 'Delete', ja: '削除する' }),
    done: text({
      en: 'Deleted the review, and its reports with it.',
      ja: 'レビューを削除しました。通報も、一緒に削除しました。',
    }),
    forbidden: text({
      en: 'This account cannot delete this review. Only the customer who wrote it and administrators can delete a review.',
      ja: 'このアカウントでは、このレビューを削除できません。レビューを削除できるのは、書いたお客様と、管理者です。',
    }),
    failed: text({
      en: 'Could not delete the review. Check your connection and try again.',
      ja: 'レビューを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
