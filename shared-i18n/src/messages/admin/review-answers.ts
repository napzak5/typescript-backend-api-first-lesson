import { type LocalizedText, text } from '../../languages/localized-text'
import { REVIEW_WORDS } from './review-words'

/*
 * The answer of a salon to a review: how the review shows it, the screen
 * that writes it and changes it, and its withdrawal. The answer stands as
 * it was written.
 */

export const reviewAnswers = {
  /** The part of the review that shows the answer */
  answer: {
    none: text({
      en: 'The salon has not responded yet.',
      ja: 'まだ返信していません。',
    }),
    /** When the salon answered: 「返信日時 2026年11月20日（金） 09:05」 */
    respondedAt: (moment: LocalizedText) =>
      text({ en: `Responded on ${moment.en}`, ja: `返信日時 ${moment.ja}` }),
    write: text({ en: 'Write a response', ja: '返信を書く' }),
    change: REVIEW_WORDS.changeResponse,
    withdraw: text({ en: 'Withdraw the response', ja: '返信を取り下げる' }),
  },
  /** The withdrawal of the answer, after a dialog */
  withdrawal: {
    confirm: text({
      en: 'Withdraw the response?',
      ja: '返信を取り下げますか？',
    }),
    description: text({
      en: 'This removes the response of the salon from the review. A withdrawn response cannot be brought back; a response can be written again later.',
      ja: 'サロンからの返信を、このレビューから消します。消した返信は元に戻せません。返信は、あとからもう一度書けます。',
    }),
    submit: text({ en: 'Withdraw', ja: '取り下げる' }),
    done: text({ en: 'Withdrew the response.', ja: '返信を取り下げました。' }),
    /** The review changed its address meanwhile */
    invalid: text({
      en: 'Could not withdraw the response. Reload the screen and try again.',
      ja: '返信を取り下げられませんでした。画面を読み込み直して、もう一度お試しください。',
    }),
    forbidden: text({
      en: 'This account cannot withdraw this response. Only the owners and managers of the salon, and administrators, can withdraw it.',
      ja: 'このアカウントでは、この返信を取り下げられません。取り下げられるのは、サロンのオーナーとマネージャーと、管理者です。',
    }),
    failed: text({
      en: 'Could not withdraw the response. Check your connection and try again.',
      ja: '返信を取り下げられませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The screen that writes the answer, and changes it */
  response: {
    review: text({ en: 'Review by the customer', ja: 'お客様のレビュー' }),
    submit: text({ en: 'Post the response', ja: '返信する' }),
    change: REVIEW_WORDS.changeResponse,
    cancel: REVIEW_WORDS.cancel,
    label: REVIEW_WORDS.response,
    description: text({
      en: 'Shown below the review as the response from the salon. The customer and everybody who reads the review read it.',
      ja: 'サロンからの返信として、レビューの下に載ります。お客様と、レビューを読むすべての人が読みます。',
    }),
    missing: text({
      en: 'Enter the response.',
      ja: '返信を入力してください。',
    }),
    forbidden: text({
      en: 'This account cannot respond to this review. Only the owners and managers of the salon can respond.',
      ja: 'このアカウントでは、このレビューに返信できません。返信できるのは、サロンのオーナーとマネージャーです。',
    }),
    failed: text({
      en: 'Could not send the response. Check your connection and try again.',
      ja: '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    responded: text({
      en: 'Posted the response to the review.',
      ja: 'レビューに返信しました。',
    }),
    changed: text({ en: 'Saved the response.', ja: '返信を直しました。' }),
    /** What the screen says to an account whose role writes no answers */
    notForAccount: text({
      en: 'This account cannot respond to reviews. Only the owners and managers of the salon can write responses.',
      ja: 'このアカウントでは、レビューに返信できません。返信を書けるのは、サロンのオーナーとマネージャーです。',
    }),
    toReview: text({ en: 'Back to the review', ja: 'レビューへ戻る' }),
  },
}
