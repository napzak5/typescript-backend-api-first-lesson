/** A plain-text message to one recipient. */
export type Mail = {
  to: string
  subject: string
  text: string
}

/**
 * Sends mail. `deliver` only hands the message over: the delivery goes on
 * after the call has returned, and a failure is the mailer's to report. A
 * use case therefore takes the same time whether it sends a message or not,
 * and its response cannot tell whether an account exists.
 */
export interface IMailer {
  deliver(mail: Mail): void
}
