import { type LocalizedText, text } from '../../languages/localized-text'

/**
 * What a screen says of an answer of the API that is nothing to act on,
 * and of the values it refused, in every application.
 */
export const answerMessages = {
  /** Too many requests: waiting mends it, the connection does not */
  tooManyRequests: text({
    en: 'There are too many requests. Wait a while and try again.',
    ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
  }),
  /** A request to write got no answer to act on */
  notSent: text({
    en: 'It could not be sent. Check your connection and try again.',
    ja: '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** The API refused values a form has no control for, or did not say which */
  checkTheValues: text({
    en: 'Check what you entered and try again.',
    ja: '入力した内容を確かめて、もう一度お試しください。',
  }),
  /** At a control whose value the API refused by a rule the form does not tell of */
  refusedValue: text({
    en: 'This value was not accepted. Check what you entered.',
    ja: 'この値は受け付けられませんでした。入力を確かめてください。',
  }),
  /**
   * Something could not be read. `what` is what was not read, as a
   * sentence names it: in English with its article (`the bookings`)
   */
  unread: (what: LocalizedText) =>
    text({
      en: `Could not load ${what.en}. Check your connection and try again.`,
      ja: `${what.ja}を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。`,
    }),
}
