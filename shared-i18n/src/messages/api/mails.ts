import { type LocalizedText, text } from '../../languages/localized-text'
import { countOf, joined } from '../written'

/*
 * The mails the API sends, in plain text: a subject and a body for each. A
 * body is paragraphs with a blank line between them, and the link a mail
 * asks its reader to open stands alone on its line, the same in every
 * language.
 */

/** The paragraphs of the body of a mail; a link stands as it is in every language */
const paragraphs = (
  ...parts: readonly (string | LocalizedText)[]
): LocalizedText => joined(parts, { en: '\n\n', ja: '\n\n' })

/** How long a link is valid: 「24 時間」, "24 hours" */
const hoursOf = (hours: number): LocalizedText =>
  countOf(hours, 'hour', 'hours', '時間')

/** How long a link is valid: 「30 分間」, "30 minutes" */
const minutesOf = (minutes: number): LocalizedText =>
  countOf(minutes, 'minute', 'minutes', '分間')

/** How long a link is valid: 「7 日間」, "7 days" */
const daysOf = (days: number): LocalizedText =>
  countOf(days, 'day', 'days', '日間')

/** How many backup codes are left: 「8 個」, "8 backup codes" */
const backupCodesOf = (count: number): LocalizedText =>
  countOf(count, 'backup code', 'backup codes', '個')

/** What to do when the reader did not do what a notice tells of */
const NOT_YOU = text({
  en: 'If you did not do this, reset your password from the sign-in screen at once. Resetting it signs you out on every device.',
  ja: '操作した覚えがない場合は、サインインの画面からすぐにパスワードを再設定してください。再設定すると、すべての端末からサインアウトされます。',
})

/** The mails the API sends: what a reader is asked to do, and what they are told of. */
export const mailMessages = {
  emailVerification: {
    subject: text({
      en: 'Confirm your email address',
      ja: 'メールアドレスの確認',
    }),
    /** With the link that confirms the address, and how many hours it is valid for */
    text: (link: string, hours: number): LocalizedText =>
      paragraphs(
        text({
          en: 'Open the following link to confirm your email address.',
          ja: 'メールアドレスを確認するため、次のリンクを開いてください。',
        }),
        link,
        text({
          en: `The link is valid for ${hoursOf(hours).en}. If you receive a new confirmation email, use the link in the new one.`,
          ja: `このリンクは ${hoursOf(hours).ja}有効です。新しい確認メールを受け取った場合は、新しいメールのリンクを使ってください。`,
        }),
        text({
          en: 'If you did not expect this email, discard it and do nothing. The account is not activated unless the link is opened.',
          ja: 'このメールに心当たりがない場合は、何もせずに破棄してください。リンクを開かなければ、アカウントは有効になりません。',
        }),
      ),
  },
  passwordReset: {
    subject: text({ en: 'Reset your password', ja: 'パスワードの再設定' }),
    /** With the link that resets the password, and how many minutes it is valid for */
    text: (link: string, minutes: number): LocalizedText =>
      paragraphs(
        text({
          en: 'Open the following link to reset your password.',
          ja: 'パスワードを再設定するには、次のリンクを開いてください。',
        }),
        link,
        text({
          en: `The link is valid for ${minutesOf(minutes).en} and can be used once.`,
          ja: `このリンクは ${minutesOf(minutes).ja}有効で、1 回だけ使えます。`,
        }),
        text({
          en: 'If you did not ask to reset your password, discard this email. Your password is not changed.',
          ja: '再設定を依頼していない場合は、このメールを破棄してください。パスワードは変更されません。',
        }),
      ),
  },
  staffInvitation: {
    subject: text({
      en: 'Invitation to a staff account',
      ja: 'スタッフアカウントへの招待',
    }),
    /**
     * With the name of the salon, as the salon wrote it, the link that
     * accepts the invitation, and how many days it is valid for
     */
    text: (salonName: string, link: string, days: number): LocalizedText =>
      paragraphs(
        text({
          en: `${salonName} has invited you to a staff account.`,
          ja: `${salonName} から、スタッフアカウントへの招待が届いています。`,
        }),
        text({
          en: 'To accept the invitation, open the following link. You set a password and create the account. If you already have a staff account with this email address, you sign in and join.',
          ja: '招待を受けるには、次のリンクを開いてください。パスワードを設定して、アカウントを作成します。このメールアドレスのスタッフアカウントをすでにお持ちの場合は、サインインして参加します。',
        }),
        link,
        text({
          en: `The link is valid for ${daysOf(days).en} and can be used once. If you receive a new invitation email, use the link in the new one.`,
          ja: `このリンクは ${daysOf(days).ja}有効で、1 回だけ使えます。新しい招待メールを受け取った場合は、新しいメールのリンクを使ってください。`,
        }),
        text({
          en: 'If you did not expect this email, discard it and do nothing. Nothing changes unless the link is opened.',
          ja: 'このメールに心当たりがない場合は、何もせずに破棄してください。リンクを開かなければ、何も変わりません。',
        }),
      ),
  },
  passwordChanged: {
    subject: text({
      en: 'Your password was changed',
      ja: 'パスワードが変更されました',
    }),
    text: paragraphs(
      text({
        en: 'The password of your account was changed.',
        ja: 'アカウントのパスワードが変更されました。',
      }),
      text({
        en: 'If you did not change it, reset your password from the sign-in screen at once. Resetting it signs you out on every device.',
        ja: '変更した覚えがない場合は、サインインの画面からすぐにパスワードを再設定してください。再設定すると、すべての端末からサインアウトされます。',
      }),
    ),
  },
  twoFactorEnabled: {
    subject: text({
      en: 'Two-factor authentication was turned on',
      ja: '2 要素認証が有効になりました',
    }),
    text: paragraphs(
      text({
        en: 'Two-factor authentication was turned on for your account. From your next sign-in, you need a code from your authenticator app as well as your password.',
        ja: 'アカウントの 2 要素認証が有効になりました。次回のサインインから、パスワードに加えて認証アプリのコードが必要です。',
      }),
      NOT_YOU,
    ),
  },
  twoFactorDisabled: {
    subject: text({
      en: 'Two-factor authentication was turned off',
      ja: '2 要素認証が無効になりました',
    }),
    text: paragraphs(
      text({
        en: 'Two-factor authentication was turned off for your account. Signing in takes only your password.',
        ja: 'アカウントの 2 要素認証が無効になりました。サインインに必要なのはパスワードだけです。',
      }),
      NOT_YOU,
    ),
  },
  twoFactorReset: {
    subject: text({
      en: 'Two-factor authentication was turned off by an administrator',
      ja: '2 要素認証が管理者によって無効にされました',
    }),
    text: paragraphs(
      text({
        en: 'An administrator turned off two-factor authentication for your account. Signing in takes only your password. Once you can use your authenticator app, set up two-factor authentication again.',
        ja: '管理者が、アカウントの 2 要素認証を無効にしました。サインインに必要なのはパスワードだけです。認証アプリを使えるようになったら、2 要素認証を設定し直してください。',
      }),
      text({
        en: 'If you did not ask for this, reset your password from the sign-in screen at once and set up two-factor authentication again. Resetting it signs you out on every device.',
        ja: '依頼した覚えがない場合は、サインインの画面からすぐにパスワードを再設定し、2 要素認証を設定し直してください。再設定すると、すべての端末からサインアウトされます。',
      }),
    ),
  },
  backupCodesRegenerated: {
    subject: text({
      en: 'Your backup codes were issued again',
      ja: 'バックアップコードが再発行されました',
    }),
    text: paragraphs(
      text({
        en: 'The backup codes of your two-factor authentication were issued again. The backup codes you had before can no longer be used.',
        ja: '2 要素認証のバックアップコードが再発行されました。それまでのバックアップコードは使えません。',
      }),
      NOT_YOU,
    ),
  },
  backupCodeUsed: {
    subject: text({
      en: 'You signed in with a backup code',
      ja: 'バックアップコードでサインインしました',
    }),
    /** With how many backup codes are left */
    text: (left: number): LocalizedText =>
      paragraphs(
        text({
          en: `You signed in with a backup code. The code you used can no longer be used. You have ${backupCodesOf(left).en} left.`,
          ja: `バックアップコードを使ってサインインしました。使ったコードはもう使えません。残りのバックアップコードは ${backupCodesOf(left).ja}です。`,
        }),
        text({
          en: 'If you can no longer use your authenticator app, turn two-factor authentication off and set it up again.',
          ja: '認証アプリを使えなくなった場合は、2 要素認証をいったん無効にして、設定し直してください。',
        }),
        NOT_YOU,
      ),
  },
}
