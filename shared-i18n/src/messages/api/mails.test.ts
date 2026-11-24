import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { mailMessages } from './mails'

const FOUND = messagesOf({ mailMessages }, '')

const LINK = 'https://portal.example.com/verify-email#token=abc'

/** Every message of a mail that is made from a value, with a value and what it then says. */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'mailMessages.emailVerification.text',
    mailMessages.emailVerification.text(LINK, 24),
    {
      en: [
        'Open the following link to confirm your email address.',
        LINK,
        'The link is valid for 24 hours. If you receive a new confirmation email, use the link in the new one.',
        'If you did not expect this email, discard it and do nothing. The account is not activated unless the link is opened.',
      ].join('\n\n'),
      ja: [
        'メールアドレスを確認するため、次のリンクを開いてください。',
        LINK,
        'このリンクは 24 時間有効です。新しい確認メールを受け取った場合は、新しいメールのリンクを使ってください。',
        'このメールに心当たりがない場合は、何もせずに破棄してください。リンクを開かなければ、アカウントは有効になりません。',
      ].join('\n\n'),
    },
  ],
  [
    'mailMessages.passwordReset.text',
    mailMessages.passwordReset.text(LINK, 30),
    {
      en: [
        'Open the following link to reset your password.',
        LINK,
        'The link is valid for 30 minutes and can be used once.',
        'If you did not ask to reset your password, discard this email. Your password is not changed.',
      ].join('\n\n'),
      ja: [
        'パスワードを再設定するには、次のリンクを開いてください。',
        LINK,
        'このリンクは 30 分間有効で、1 回だけ使えます。',
        '再設定を依頼していない場合は、このメールを破棄してください。パスワードは変更されません。',
      ].join('\n\n'),
    },
  ],
  [
    'mailMessages.staffInvitation.text',
    mailMessages.staffInvitation.text('Salon Kushi 表参道', LINK, 7),
    {
      en: [
        'Salon Kushi 表参道 has invited you to a staff account.',
        'To accept the invitation, open the following link. You set a password and create the account. If you already have a staff account with this email address, you sign in and join.',
        LINK,
        'The link is valid for 7 days and can be used once. If you receive a new invitation email, use the link in the new one.',
        'If you did not expect this email, discard it and do nothing. Nothing changes unless the link is opened.',
      ].join('\n\n'),
      ja: [
        'Salon Kushi 表参道 から、スタッフアカウントへの招待が届いています。',
        '招待を受けるには、次のリンクを開いてください。パスワードを設定して、アカウントを作成します。このメールアドレスのスタッフアカウントをすでにお持ちの場合は、サインインして参加します。',
        LINK,
        'このリンクは 7 日間有効で、1 回だけ使えます。新しい招待メールを受け取った場合は、新しいメールのリンクを使ってください。',
        'このメールに心当たりがない場合は、何もせずに破棄してください。リンクを開かなければ、何も変わりません。',
      ].join('\n\n'),
    },
  ],
  [
    'mailMessages.backupCodeUsed.text',
    mailMessages.backupCodeUsed.text(8),
    {
      en: [
        'You signed in with a backup code. The code you used can no longer be used. You have 8 backup codes left.',
        'If you can no longer use your authenticator app, turn two-factor authentication off and set it up again.',
        'If you did not do this, reset your password from the sign-in screen at once. Resetting it signs you out on every device.',
      ].join('\n\n'),
      ja: [
        'バックアップコードを使ってサインインしました。使ったコードはもう使えません。残りのバックアップコードは 8 個です。',
        '認証アプリを使えなくなった場合は、2 要素認証をいったん無効にして、設定し直してください。',
        '操作した覚えがない場合は、サインインの画面からすぐにパスワードを再設定してください。再設定すると、すべての端末からサインアウトされます。',
      ].join('\n\n'),
    },
  ],
]

describe('the messages of the mails', () => {
  it.each(MADE)(
    'should name the values it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      FOUND.made.toSorted(),
    )
  })

  it.each<[string, LocalizedText, string]>([
    [
      'a link valid for one hour',
      mailMessages.emailVerification.text(LINK, 1),
      'The link is valid for 1 hour.',
    ],
    [
      'a link valid for one minute',
      mailMessages.passwordReset.text(LINK, 1),
      'The link is valid for 1 minute ',
    ],
    [
      'an invitation valid for one day',
      mailMessages.staffInvitation.text('Kushi', LINK, 1),
      'The link is valid for 1 day ',
    ],
    [
      'one backup code left',
      mailMessages.backupCodeUsed.text(1),
      'You have 1 backup code left.',
    ],
  ])('should count one in the singular in English: %s', (_case, made, said) => {
    // Assert
    expect(made.en).toContain(said)
  })

  it('should put a blank line between the paragraphs of a body, with the link alone on its line', () => {
    // Act
    const body = mailMessages.passwordReset.text(LINK, 30)

    // Assert
    expect(body.en.split('\n')).toEqual([
      'Open the following link to reset your password.',
      '',
      LINK,
      '',
      'The link is valid for 30 minutes and can be used once.',
      '',
      'If you did not ask to reset your password, discard this email. Your password is not changed.',
    ])
    expect(body.ja.split('\n\n')[1]).toBe(LINK)
  })
})
