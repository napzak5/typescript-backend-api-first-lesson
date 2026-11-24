import {
  type Locale,
  type LocalizedText,
  textIn,
} from '@beauty-salon-shared/i18n'

/**
 * A plain-text message to one recipient. Its subject and its body are
 * messages, written in every language; `language` is the one it is sent in,
 * that of the request that caused it. Whoever sends it writes it in that
 * language, as an error is told where it is answered.
 */
export type Mail = {
  to: string
  language: Locale
  subject: LocalizedText
  text: LocalizedText
}

/** A mail as its recipient reads it: the subject and the body in its language. */
export type WrittenMail = {
  to: string
  language: Locale
  subject: string
  text: string
}

/** Writes a mail in the language it is sent in. */
export const writtenMail = ({
  to,
  language,
  subject,
  text,
}: Mail): WrittenMail => ({
  to,
  language,
  subject: textIn(subject, language),
  text: textIn(text, language),
})

/**
 * Sends mail. `deliver` only hands the message over: the delivery goes on
 * after the call has returned, and a failure is the mailer's to report. A
 * use case therefore takes the same time whether it sends a message or not,
 * and its response cannot tell whether an account exists.
 */
export interface IMailer {
  deliver(mail: Mail): void
}
