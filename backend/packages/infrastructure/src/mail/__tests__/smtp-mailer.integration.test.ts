import type { Mail } from '@beauty-salon-backend/domain'
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers'
import { match, P } from 'ts-pattern'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '../../logging/logger'
import { SmtpMailer, type SmtpSettings } from '../smtp-mailer'

/**
 * Mails go to a real SMTP server: Mailpit, which keeps what it receives and
 * shows it through an HTTP API. It offers no STARTTLS and no implicit TLS on
 * its SMTP port, accepts any credentials, and refuses recipients outside
 * salon.example, so that a refused recipient can be seen too.
 */

const SMTP_PORT = 1025
const HTTP_PORT = 8025

let container: StartedTestContainer | undefined
let smtp: Pick<SmtpSettings, 'host' | 'port'> = { host: '', port: 0 }
let mailpit = ''

beforeAll(async () => {
  container = await new GenericContainer('axllent/mailpit:v1.33.1')
    .withEnvironment({
      MP_SMTP_AUTH_ACCEPT_ANY: 'true',
      MP_SMTP_AUTH_ALLOW_INSECURE: 'true',
      MP_SMTP_ALLOWED_RECIPIENTS: '@salon\\.example$',
    })
    .withExposedPorts(SMTP_PORT, HTTP_PORT)
    .withWaitStrategy(Wait.forHttp('/readyz', HTTP_PORT).forStatusCode(200))
    .start()

  smtp = {
    host: container.getHost(),
    port: container.getMappedPort(SMTP_PORT),
  }
  mailpit = `http://${container.getHost()}:${container.getMappedPort(HTTP_PORT)}`
})

afterAll(async () => {
  await container?.stop()
})

beforeEach(async () => {
  const deleted = await fetch(`${mailpit}/api/v1/messages`, {
    method: 'DELETE',
  })
  expect(deleted.status).toBe(200)
})

type Address = { name: string; address: string }

type StoredMessage = {
  id: string
  from: Address
  to: Address[]
  subject: string
}

const unexpected = (body: unknown): never => {
  throw new Error(`Unexpected answer from Mailpit: ${JSON.stringify(body)}`)
}

const ADDRESS = { Name: P.string, Address: P.string }

const toAddress = ({
  Name,
  Address,
}: {
  Name: string
  Address: string
}): Address => ({ name: Name, address: Address })

/** Every message Mailpit holds. */
const storedMessages = async (): Promise<StoredMessage[]> => {
  const body: unknown = await (await fetch(`${mailpit}/api/v1/messages`)).json()

  return match(body)
    .with(
      {
        messages: P.array({
          ID: P.string,
          From: ADDRESS,
          To: P.array(ADDRESS),
          Subject: P.string,
        }),
      },
      ({ messages }) =>
        messages.map(({ ID, From, To, Subject }) => ({
          id: ID,
          from: toAddress(From),
          to: To.map(toAddress),
          subject: Subject,
        })),
    )
    .otherwise(unexpected)
}

/** The plain text of a message, with the line ends of the mail turned into \n. */
const textOf = async (id: string): Promise<string> => {
  const body: unknown = await (
    await fetch(`${mailpit}/api/v1/message/${id}`)
  ).json()

  return match(body)
    .with({ Text: P.string }, ({ Text }) => Text.replaceAll('\r\n', '\n'))
    .otherwise(unexpected)
}

/** A mailer for Mailpit whose logger writes into `lines`, one parsed object per line. */
const mailerFor = (settings: Partial<SmtpSettings> = {}) => {
  const lines: unknown[] = []
  const logger = createLogger(
    { level: 'info', format: 'json', environment: 'test' },
    { write: (line) => lines.push(JSON.parse(line)) },
  )
  const mailer = new SmtpMailer(
    {
      ...smtp,
      tls: 'none',
      user: 'salon-api',
      password: 'smtp-password',
      from: 'Beauty Salon <no-reply@salon.example>',
      ...settings,
    },
    logger,
  )
  return { mailer, lines }
}

const TOKEN = 'Xq3vT0kEnFr0mTh3Ma1lXq3vT0kEnFr0mTh3Ma1lAb'

/** The three mails of the authentication flows, as the application writes them. */
const mails: Mail[] = [
  {
    to: 'hanako@salon.example',
    subject: 'メールアドレスの確認',
    text: [
      'メールアドレスを確認するため、次のリンクを開いてください。',
      '',
      `https://app.salon.example/verify-email#token=${TOKEN}`,
      '',
      'このリンクは 24 時間有効です。新しい確認メールを受け取った場合は、新しいメールのリンクを使ってください。',
      '',
      'このメールに心当たりがない場合は、何もせずに破棄してください。リンクを開かなければ、アカウントは有効になりません。',
    ].join('\n'),
  },
  {
    to: 'taro.yamada@salon.example',
    subject: 'パスワードの再設定',
    text: [
      'パスワードを再設定するには、次のリンクを開いてください。',
      '',
      `https://app.salon.example/reset-password#token=${TOKEN}`,
      '',
      'このリンクは 30 分間有効で、1 回だけ使えます。',
      '',
      '再設定を依頼していない場合は、このメールを破棄してください。パスワードは変更されません。',
    ].join('\n'),
  },
  {
    to: 'jiro@salon.example',
    subject: 'パスワードが変更されました',
    text: [
      'アカウントのパスワードが変更されました。',
      '',
      '変更した覚えがない場合は、ログイン画面からすぐにパスワードを再設定してください。再設定すると、すべての端末からログアウトされます。',
    ].join('\n'),
  },
]

describe('SmtpMailer with a real SMTP server', () => {
  it.each(mails)(
    'delivers the mail "$subject" with its recipient, subject and text intact',
    async (sent) => {
      const { mailer, lines } = mailerFor()

      mailer.deliver(sent)
      await mailer.close()

      const stored = await storedMessages()
      expect(stored).toEqual([
        {
          id: expect.any(String),
          from: { name: 'Beauty Salon', address: 'no-reply@salon.example' },
          to: [{ name: '', address: sent.to }],
          subject: sent.subject,
        },
      ])
      expect(await textOf(stored[0]?.id ?? '')).toBe(sent.text)
      expect(lines).toEqual([
        expect.objectContaining({
          level: 'info',
          msg: 'Mail delivered',
          subject: sent.subject,
        }),
      ])
    },
  )

  it.each<[string, string, Address]>([
    [
      'an address alone',
      'no-reply@salon.example',
      { name: '', address: 'no-reply@salon.example' },
    ],
    [
      'a display name',
      'Beauty Salon <no-reply@salon.example>',
      { name: 'Beauty Salon', address: 'no-reply@salon.example' },
    ],
    [
      'a display name in Japanese',
      'ビューティーサロン青山 <no-reply@salon.example>',
      { name: 'ビューティーサロン青山', address: 'no-reply@salon.example' },
    ],
  ])('sends from %s', async (_case, from, expected) => {
    const { mailer } = mailerFor({ from })

    mailer.deliver(mails[0] ?? unexpected(mails))
    await mailer.close()

    expect((await storedMessages()).map((message) => message.from)).toEqual([
      expected,
    ])
  })

  it('has delivered every mail handed over once close resolves', async () => {
    const { mailer, lines } = mailerFor()
    const sent = [...mails, ...mails].map((mail, index) => ({
      ...mail,
      subject: `${mail.subject} ${index + 1}`,
    }))

    for (const mail of sent) {
      mailer.deliver(mail)
    }
    await mailer.close()

    const stored = await storedMessages()
    expect(stored.map(({ subject }) => subject).sort()).toEqual(
      sent.map(({ subject }) => subject).sort(),
    )
    expect(lines).toHaveLength(sent.length)
  })

  it('logs a delivered mail with its subject only', async () => {
    const { mailer, lines } = mailerFor()

    mailer.deliver(mails[1] ?? unexpected(mails))
    await mailer.close()

    const logged = JSON.stringify(lines)
    for (const secret of [
      'taro.yamada@salon.example',
      TOKEN,
      'reset-password',
      'smtp-password',
    ]) {
      expect(logged).not.toContain(secret)
    }
  })

  it('does not fall back to plain text when STARTTLS is required and the server does not offer it', async () => {
    const { mailer, lines } = mailerFor({ tls: 'starttls' })

    mailer.deliver(mails[0] ?? unexpected(mails))
    await mailer.close()

    expect(await storedMessages()).toEqual([])
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'error',
        msg: 'Failed to deliver mail',
        subject: 'メールアドレスの確認',
        // Observed with nodemailer 10.5.0: the server answers STARTTLS with
        // 502, and nodemailer stops there.
        failure: {
          message: expect.stringContaining('STARTTLS'),
          code: 'ETLS',
          command: 'STARTTLS',
          responseCode: 502,
        },
      }),
    ])
  })

  it('fails and logs when implicit TLS meets a plain SMTP port', async () => {
    const { mailer, lines } = mailerFor({ tls: 'implicit' })

    mailer.deliver(mails[0] ?? unexpected(mails))
    await mailer.close()

    expect(await storedMessages()).toEqual([])
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'error',
        msg: 'Failed to deliver mail',
        subject: 'メールアドレスの確認',
        failure: expect.objectContaining({ code: expect.any(String) }),
      }),
    ])
  })

  it('logs a recipient the server refuses with its verdict, without the recipient or the text', async () => {
    const { mailer, lines } = mailerFor()
    const refused = {
      ...(mails[0] ?? unexpected(mails)),
      to: 'hanako@elsewhere.example',
    }

    mailer.deliver(refused)
    await mailer.close()

    expect(await storedMessages()).toEqual([])
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'error',
        msg: 'Failed to deliver mail',
        subject: 'メールアドレスの確認',
        failure: expect.objectContaining({
          responseCode: expect.any(Number),
        }),
      }),
    ])
    const logged = JSON.stringify(lines)
    expect(logged).not.toContain('hanako@elsewhere.example')
    expect(logged).not.toContain('elsewhere.example')
    expect(logged).not.toContain(TOKEN)
  })
})
