import { text } from '../../languages/localized-text'
import { securityMessages } from '../ui/security'
import { STAFF_WORDS } from './staff-words'

/*
 * The words that the accounts of the staff and the accounts of the users
 * share: the fields of an account, what its state and its second factor
 * are called, and what a state that keeps a user out means.
 */

/** The words of the fields of an account, which both records name alike */
export const ACCOUNT_WORDS = {
  account: STAFF_WORDS.account,
  email: STAFF_WORDS.email,
  role: text({ en: 'Role', ja: 'ロール' }),
  status: STAFF_WORDS.status,
  twoFactor: securityMessages.twoFactor.title,
  lastLogin: text({ en: 'Last sign-in', ja: '最後のログイン' }),
  neverSignedIn: text({
    en: 'Has not signed in yet',
    ja: 'まだログインしていません',
  }),
  createdAt: text({ en: 'Created', ja: '作った日時' }),
  /** The states of an account, by the values of the API */
  statuses: {
    active: text({ en: 'Active', ja: '有効' }),
    unverified: text({
      en: 'Email address not confirmed yet',
      ja: 'メールアドレスの確認待ち',
    }),
    inactive: text({ en: 'Inactive', ja: '無効' }),
    locked: text({ en: 'Locked', ja: 'ロック中' }),
    suspended: text({ en: 'Suspended', ja: '停止中' }),
    deleted: text({ en: 'Deleted', ja: '削除済み' }),
  },
  /** What a state that keeps the user out means for them, by the values of the API */
  statusNotes: {
    unverified: text({
      en: 'The account cannot sign in until its email address is confirmed.',
      ja: 'メールアドレスの確認が済むまで、ログインできません。',
    }),
    inactive: text({
      en: 'This account cannot sign in.',
      ja: 'このアカウントでは、ログインできません。',
    }),
    locked: text({
      en: 'After wrong passwords in a row, the account cannot sign in anew for 15 minutes. The devices that are signed in can still be used. Only an administrator can lift the lock at once.',
      ja: 'パスワードを続けて誤ったため、15 分の間、新しいログインができません。ログインしている端末は、そのまま使えます。すぐに解くのは、管理者の操作です。',
    }),
    suspended: text({
      en: 'This account is suspended and cannot sign in. An administrator suspended it.',
      ja: 'このアカウントは止められていて、ログインできません。止めたのは、管理者です。',
    }),
    deleted: text({
      en: 'This account is deleted.',
      ja: 'このアカウントは、削除されています。',
    }),
  },
  /** Whether an account asks for a code of an authenticator at sign-in, by the values of the API */
  twoFactorStatuses: {
    disabled: text({ en: 'Not set up', ja: '設定していません' }),
    pending: text({ en: 'Being set up', ja: '設定の途中です' }),
    enabled: text({ en: 'Set up', ja: '設定しています' }),
  },
}
