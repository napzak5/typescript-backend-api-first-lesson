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

/** What to do when the user did not do what a notice tells of. */
const NOT_YOU =
  '操作した覚えがない場合は、ログイン画面からすぐにパスワードを再設定してください。再設定すると、すべての端末からログアウトされます。'

export const twoFactorEnabledMail = (to: string): Mail => ({
  to,
  subject: '2 要素認証が有効になりました',
  text: [
    'アカウントの 2 要素認証が有効になりました。次回のログインから、パスワードに加えて認証アプリのコードが必要です。',
    '',
    NOT_YOU,
  ].join('\n'),
})

export const twoFactorDisabledMail = (to: string): Mail => ({
  to,
  subject: '2 要素認証が無効になりました',
  text: [
    'アカウントの 2 要素認証が無効になりました。ログインに必要なのはパスワードだけです。',
    '',
    NOT_YOU,
  ].join('\n'),
})

export const backupCodesRegeneratedMail = (to: string): Mail => ({
  to,
  subject: 'バックアップコードが再発行されました',
  text: [
    '2 要素認証のバックアップコードが再発行されました。それまでのバックアップコードは使えません。',
    '',
    NOT_YOU,
  ].join('\n'),
})

export const backupCodeUsedMail = (
  to: string,
  backupCodesLeft: number,
): Mail => ({
  to,
  subject: 'バックアップコードでログインしました',
  text: [
    `バックアップコードを使ってログインしました。使ったコードはもう使えません。残りのバックアップコードは ${backupCodesLeft} 個です。`,
    '',
    '認証アプリを使えなくなった場合は、2 要素認証をいったん無効にして、設定し直してください。',
    '',
    NOT_YOU,
  ].join('\n'),
})
