import type { IMailer, Mail } from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { createTransport } from 'nodemailer'
import { match, P } from 'ts-pattern'
import type { Logger } from '../logging/logger'

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
 * What a failed delivery leaves for the log: the stage of the SMTP dialogue
 * and the server's verdict, never the message or its recipient.
 */
const describeFailure = (error: unknown) => ({
  message: match(error)
    .with({ message: P.string }, ({ message }) => message)
    .otherwise(() => 'Mail delivery failed'),
  code: match(error)
    .with({ code: P.string }, ({ code }) => code)
    .otherwise(() => null),
  command: match(error)
    .with({ command: P.string }, ({ command }) => command)
    .otherwise(() => null),
  responseCode: match(error)
    .with({ responseCode: P.number }, ({ responseCode }) => responseCode)
    .otherwise(() => null),
})

/**
 * Sends mail through an SMTP server. `deliver` returns at once and the
 * delivery goes on in the background, as `IMailer` asks; a failure is
 * logged with the subject of the message, which tells its kind, and without
 * the recipient. Which provider carries the mail is a matter of where the
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

  private async send({ to, subject, text }: Mail): Promise<void> {
    const sent = await Result.fromPromise(
      this.transport.sendMail({
        from: this.settings.from,
        to,
        subject,
        text,
      }),
    )

    if (sent.type === 'error') {
      this.logger.error(
        { subject, failure: describeFailure(sent.error) },
        'Failed to deliver mail',
      )
      return
    }
    this.logger.info({ subject }, 'Mail delivered')
  }
}
