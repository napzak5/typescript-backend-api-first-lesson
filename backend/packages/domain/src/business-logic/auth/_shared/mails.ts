import type { Mail } from '../../../services/mailer'
import {
  EMAIL_VERIFICATION,
  type MailedTokenKind,
  PASSWORD_RESET,
} from './mailed-token'

/**
 * The mails of the authentication flows, as plain text. A link points at a
 * page of the web application, whose address is configuration and never
 * taken from the request. The token is in the fragment, which a browser
 * sends to no server and leaves out of the Referer header.
 */

const linkTo = (publicAppUrl: string, page: string, token: string): string =>
  `${publicAppUrl}/${page}#token=${token}`

const hoursOf = ({ lifetimeMinutes }: MailedTokenKind): number =>
  lifetimeMinutes / 60

export const emailVerificationMail = (
  to: string,
  publicAppUrl: string,
  token: string,
): Mail => ({
  to,
  subject: 'メールアドレスの確認',
  text: [
    'メールアドレスを確認するため、次のリンクを開いてください。',
    '',
    linkTo(publicAppUrl, 'verify-email', token),
    '',
    `このリンクは ${hoursOf(EMAIL_VERIFICATION)} 時間有効です。新しい確認メールを受け取った場合は、新しいメールのリンクを使ってください。`,
    '',
    'このメールに心当たりがない場合は、何もせずに破棄してください。リンクを開かなければ、アカウントは有効になりません。',
  ].join('\n'),
})

export const passwordResetMail = (
  to: string,
  publicAppUrl: string,
  token: string,
): Mail => ({
  to,
  subject: 'パスワードの再設定',
  text: [
    'パスワードを再設定するには、次のリンクを開いてください。',
    '',
    linkTo(publicAppUrl, 'reset-password', token),
    '',
    `このリンクは ${PASSWORD_RESET.lifetimeMinutes} 分間有効で、1 回だけ使えます。`,
    '',
    '再設定を依頼していない場合は、このメールを破棄してください。パスワードは変更されません。',
  ].join('\n'),
})

export const passwordChangedMail = (to: string): Mail => ({
  to,
  subject: 'パスワードが変更されました',
  text: [
    'アカウントのパスワードが変更されました。',
    '',
    '変更した覚えがない場合は、ログイン画面からすぐにパスワードを再設定してください。再設定すると、すべての端末からログアウトされます。',
  ].join('\n'),
})
