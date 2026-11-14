import type { Mail } from '@beauty-salon-backend/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '../../logging/logger'
import { SmtpMailer, type SmtpSettings } from '../smtp-mailer'

/** A server nobody listens on: every connection is refused at once. */
const unreachable: SmtpSettings = {
  host: '127.0.0.1',
  port: 1,
  tls: 'none',
  user: 'salon-api',
  password: 'smtp-password',
  from: 'Beauty Salon <no-reply@salon.example>',
}

const TOKEN = 'Xq3vT0kEnFr0mTh3Ma1lXq3vT0kEnFr0mTh3Ma1lAb'

const mail = (overrides: Partial<Mail> = {}): Mail => ({
  to: 'hanako@example.com',
  subject: 'メールアドレスの確認',
  text: `次のリンクを開いてください。\n\nhttps://app.salon.example/verify-email#token=${TOKEN}\n`,
  ...overrides,
})

/** A mailer whose logger writes into `lines`, one parsed object per line. */
const recordingMailer = (settings: SmtpSettings = unreachable) => {
  const lines: unknown[] = []
  const logger = createLogger(
    { level: 'info', format: 'json', environment: 'test' },
    { write: (line) => lines.push(JSON.parse(line)) },
  )
  return { mailer: new SmtpMailer(settings, logger), lines }
}

/** Lets the event loop run once, so that a rejection nobody handles is reported. */
const nextTurn = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve))

describe('SmtpMailer', () => {
  const unhandled: unknown[] = []
  const recordUnhandled = (reason: unknown): void => {
    unhandled.push(reason)
  }

  beforeEach(() => {
    unhandled.length = 0
    process.on('unhandledRejection', recordUnhandled)
  })

  afterEach(() => {
    process.off('unhandledRejection', recordUnhandled)
  })

  it('returns from deliver at once, without a value, before anything is sent', () => {
    const { mailer, lines } = recordingMailer()

    const returned = mailer.deliver(mail())

    expect(returned).toBeUndefined()
    expect(lines).toEqual([])
    return mailer.close()
  })

  it('logs a delivery the server refused, with the stage of the SMTP dialogue, once close resolves', async () => {
    const { mailer, lines } = recordingMailer()

    mailer.deliver(mail())
    await mailer.close()

    expect(lines).toEqual([
      expect.objectContaining({
        level: 'error',
        msg: 'Failed to deliver mail',
        subject: 'メールアドレスの確認',
        failure: {
          message: expect.any(String),
          code: 'ESOCKET',
          command: 'CONN',
          responseCode: null,
        },
      }),
    ])
  })

  it('keeps the recipient, the text, the token and the credentials out of the log', async () => {
    const { mailer, lines } = recordingMailer()

    mailer.deliver(mail())
    await mailer.close()

    const logged = JSON.stringify(lines)
    expect(lines).toHaveLength(1)
    for (const secret of [
      'hanako@example.com',
      'hanako',
      TOKEN,
      '次のリンクを開いてください',
      'verify-email',
      'smtp-password',
    ]) {
      expect(logged).not.toContain(secret)
    }
  })

  it('never rejects a delivery that fails', async () => {
    const { mailer } = recordingMailer()

    mailer.deliver(mail())
    await mailer.close()
    await nextTurn()

    expect(unhandled).toEqual([])
  })

  it('waits in close for every delivery under way', async () => {
    const { mailer, lines } = recordingMailer()
    const subjects = [
      'メールアドレスの確認',
      'パスワードの再設定',
      'パスワードが変更されました',
    ]

    for (const subject of subjects) {
      mailer.deliver(mail({ subject }))
    }
    await mailer.close()

    expect(lines).toHaveLength(3)
    expect(lines).toEqual(
      expect.arrayContaining(
        subjects.map((subject) =>
          expect.objectContaining({
            level: 'error',
            msg: 'Failed to deliver mail',
            subject,
          }),
        ),
      ),
    )
  })

  it.each<SmtpSettings['tls']>(['implicit', 'starttls', 'none'])(
    'logs a refused connection with tls %s',
    async (tls) => {
      const { mailer, lines } = recordingMailer({ ...unreachable, tls })

      mailer.deliver(mail())
      await mailer.close()

      expect(lines).toEqual([
        expect.objectContaining({
          level: 'error',
          msg: 'Failed to deliver mail',
          failure: expect.objectContaining({ code: 'ESOCKET' }),
        }),
      ])
    },
  )

  it('resolves close when nothing was sent', async () => {
    const { mailer, lines } = recordingMailer()

    await mailer.close()

    expect(lines).toEqual([])
  })
})
