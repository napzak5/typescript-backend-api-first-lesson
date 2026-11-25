import {
  type IMailer,
  type Mail,
  writtenMail,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { createTransport } from 'nodemailer'
import { match } from 'ts-pattern'
import type { Logger } from '../logging/logger'
import { describeMailFailure } from './failure'

export type SmtpSettings = {
  host: string
  port: number
  /**
   * How the connection is encrypted:
   * - `implicit`: TLS from the first byte (port 465)
   * - `starttls`: upgraded with STARTTLS, and refused if the server cannot
   * - `none`: plain text, for a mail catcher on the developer's machine
   */
  tls: 'implicit' | 'starttls' | 'none'
  user: string
  password: string
  /** The sender of every message, such as `Beauty Salon <no-reply@example.com>`. */
  from: string
}

/** An SMTP server that is slow to answer must not hold deliveries for minutes. */
const TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
}

const encryptionOf = (tls: SmtpSettings['tls']) =>
  match(tls)
    .with('implicit', () => ({ secure: true }))
    .with('starttls', () => ({ secure: false, requireTLS: true }))
    .with('none', () => ({ secure: false, ignoreTLS: true }))
    .exhaustive()

/**
 * Sends mail through an SMTP server. `deliver` returns at once and the
 * delivery goes on in the background, as `IMailer` asks. A mail is written
 * in its language, which its `Content-Language` header names. A delivery
 * is logged with the English subject of the message, which tells its kind
 * as the log is written, and the language it was written in, without the
 * recipient. Which provider carries the mail is a matter of where the
 * settings point.
 */
export class SmtpMailer implements IMailer {
  private readonly transport: ReturnType<typeof createTransport>
  private readonly underWay = new Set<Promise<void>>()

  constructor(
    private readonly settings: SmtpSettings,
    private readonly logger: Logger,
  ) {
    this.transport = createTransport({
      host: settings.host,
      port: settings.port,
      ...encryptionOf(settings.tls),
      auth: { user: settings.user, pass: settings.password },
      ...TIMEOUTS,
      // A message is text only; nothing in it may make the mailer read a
      // file or fetch a URL.
      disableFileAccess: true,
      disableUrlAccess: true,
    })
  }

  deliver(mail: Mail): void {
    const delivery: Promise<void> = this.send(mail).finally(() => {
      this.underWay.delete(delivery)
    })
    this.underWay.add(delivery)
  }

  /**
   * Waits for the deliveries that are under way and closes the connection.
   * Each of them ends within the timeouts, so this always resolves.
   */
  async close(): Promise<void> {
    await Promise.all(this.underWay)
    this.transport.close()
  }

  private async send(mail: Mail): Promise<void> {
    const { to, language, subject, text } = writtenMail(mail)
    const sent = await Result.fromPromise(
      this.transport.sendMail({
        from: this.settings.from,
        to,
        subject,
        text,
        headers: { 'Content-Language': language },
      }),
    )
    const logged = { subject: mail.subject.en, language }

    if (sent.type === 'error') {
      this.logger.error(
        { ...logged, failure: describeMailFailure(sent.error) },
        'Failed to deliver mail',
      )
      return
    }
    this.logger.info(logged, 'Mail delivered')
  }
}
