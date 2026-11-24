import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { frameMessages } from '../ui/frame'
import { termMessages } from '../ui/terms'
import { countedIn, listed } from '../written'
import { ACCOUNT_WORDS } from './account-words'

/*
 * What the admin application says of the account of a user, as an
 * administrator answers the user who asks why they cannot sign in: the
 * state of the account, its lock and the wrong passwords that brought it,
 * the lifting of the lock and the reset of the second factor. The
 * addresses of mail, the IP addresses and the time zones stand as they
 * were written.
 */

export const adminUserAccountMessages = {
  title: ACCOUNT_WORDS.account,
  /** What a screen could not read, as a sentence names it */
  names: {
    account: text({ en: 'the account', ja: 'アカウント' }),
  },
  loading: text({
    en: 'Loading the account',
    ja: 'アカウントを読み込んでいます',
  }),
  notFound: text({
    en: 'This account cannot be found. It was deleted, or the address is wrong.',
    ja: 'このアカウントは見つかりません。削除されたか、アドレスが違います。',
  }),
  toTop: frameMessages.notFound.back,
  /** What an account that looks after no accounts is told */
  administratorsOnly: text({
    en: 'This account cannot handle sign-in accounts. Only an administrator sees the state of the accounts of the users, lifts their locks and resets their two-factor authentication.',
    ja: 'このアカウントでは、ログインアカウントを扱えません。利用者のアカウントの状態を見て、ロックを解除し、2 要素認証をリセットするのは、管理者です。',
  }),
  /** The roles of the accounts, by the values of the API */
  roles: {
    customer: text({ en: 'Customer', ja: 'お客様' }),
    ...termMessages.salonRole,
    admin: text({ en: 'Administrator', ja: '管理者' }),
  },
  /** What the screens say of the moments they show, which are in the time zone of the device */
  deviceTimeZone: (timezone: string) =>
    text({
      en: `Times are shown in the time zone of this device (${timezone}).`,
      ja: `日時は、この端末のタイムゾーン（${timezone}）で表示しています。`,
    }),
  /** The record of an account */
  record: {
    title: text({ en: 'State of the account', ja: 'アカウントの状態' }),
    words: ACCOUNT_WORDS,
    emailVerified: text({
      en: 'Email address confirmation',
      ja: 'メールアドレスの確認',
    }),
    verified: text({ en: 'Confirmed', ja: '確認済み' }),
    notVerified: text({ en: 'Not confirmed yet', ja: 'まだ確認していません' }),
    lock: text({ en: 'Lock', ja: 'ロック' }),
    failures: text({ en: 'Wrong passwords', ja: 'パスワードの誤り' }),
    passwordChange: text({ en: 'Password changed', ja: 'パスワードの変更' }),
    neverChanged: text({ en: 'Not changed yet', ja: 'まだ変えていません' }),
    lastLoginIp: text({
      en: 'IP address of the last sign-in',
      ja: '最後のログインの IP アドレス',
    }),
    noIp: text({ en: 'Not recorded', ja: '記録がありません' }),
    ledgers: text({ en: 'Linked ledgers', ja: '紐づいている台帳' }),
  },
  /** Whether wrong passwords keep an account from signing in, and what that means for the user */
  lock: {
    lockedUntil: (moment: LocalizedText) =>
      text({ en: `Locked until ${moment.en}`, ja: `${moment.ja}までロック中` }),
    ranOut: text({
      en: 'The lock has run out',
      ja: 'ロックの期限は過ぎています',
    }),
    none: text({ en: 'Not locked', ja: 'ロックされていません' }),
    lockedNote: (moment: LocalizedText) =>
      text({
        en: `After wrong passwords in a row, the account cannot sign in anew until ${moment.en}, not even with the right password. The devices that are signed in can still be used.`,
        ja: `パスワードを続けて誤ったため、${moment.ja}まで、新しいログインができません。正しいパスワードでも同じです。ログインしている端末は、そのまま使えます。`,
      }),
    ranOutNote: text({
      en: 'The lock has run out, but one more wrong password locks the account again.',
      ja: 'ロックの期限は過ぎましたが、次にパスワードを一度誤ると、またロックされます。',
    }),
  },
  /** The wrong passwords in a row */
  failures: {
    none: text({ en: 'None', ja: 'ありません' }),
    inARow: (failures: number) =>
      text({
        en: `${countedIn(failures, 'wrong password', 'wrong passwords')} in a row`,
        ja: `${numberOf(failures).ja} 回続けて誤っています`,
      }),
  },
  /** The ledgers an account is linked to */
  ledgers: {
    customers: text({ en: 'Customer ledger', ja: 'お客様の台帳' }),
    staff: text({ en: 'Staff ledger', ja: 'スタッフ台帳' }),
    none: text({
      en: 'Linked to no ledger',
      ja: 'どの台帳にも紐づいていません',
    }),
    /** The ledgers of an account, one after the other */
    listed: (ledgers: readonly LocalizedText[]): LocalizedText =>
      listed(ledgers),
  },
  /** What an administrator says of their own account */
  own: text({
    en: 'This is your own account. Another administrator lifts its lock and resets its two-factor authentication.',
    ja: 'ご自身のアカウントです。ロックの解除と 2 要素認証のリセットは、ほかの管理者が行います。',
  }),
  /** What is said of an account that needs neither */
  nothingToDo: text({
    en: 'This account is not locked, and its two-factor authentication is not on. There is nothing to do here.',
    ja: 'このアカウントは、ロックされておらず、2 要素認証も有効ではありません。ここで行う操作はありません。',
  }),
  /** The lifting of the lock */
  unlock: {
    title: text({ en: 'Lifting the lock', ja: 'ロックの解除' }),
    text: text({
      en: 'Once the lock is lifted, the user can sign in at once with their current password. The count of wrong passwords goes back to 0. The password and the devices signed in stay as they are.',
      ja: '解除すると、利用者は、いまのパスワードですぐにログインできます。パスワードの誤りの回数は 0 に戻ります。パスワードと、ログインしている端末は変わりません。',
    }),
    button: text({ en: 'Lift the lock', ja: 'ロックを解除する' }),
    done: (email: string) =>
      text({
        en: `Lifted the lock of ${email}. It can sign in at once with its current password.`,
        ja: `${email} のロックを解除しました。いまのパスワードで、すぐにログインできます。`,
      }),
    meanwhile: text({
      en: 'Meanwhile, the lock of this account was lifted: the user signed in or set a new password, or another administrator lifted it. This is how it stands now.',
      ja: 'このアカウントのロックは、その間に解けていました。利用者がログインしたか、パスワードを再設定したか、ほかの管理者が解除しました。いまの状態を表示しています。',
    }),
    failed: text({
      en: 'Could not lift the lock. Check your connection and try again.',
      ja: 'ロックを解除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The reset of the second factor, after a dialog */
  reset: {
    title: text({
      en: 'Resetting two-factor authentication',
      ja: '2 要素認証のリセット',
    }),
    text: text({
      en: 'This is for a user who lost both the authenticator app and the backup codes. Once it is reset, the user signs in with the password alone and sets up two-factor authentication again.',
      ja: '認証アプリとバックアップコードの両方をなくした利用者のための操作です。リセットすると、利用者は、パスワードだけでログインし、2 要素認証を設定し直します。',
    }),
    button: text({
      en: 'Reset two-factor authentication',
      ja: '2 要素認証をリセットする',
    }),
    question: (email: string) =>
      text({
        en: `Reset the two-factor authentication of ${email}?`,
        ja: `${email} の 2 要素認証をリセットしますか？`,
      }),
    warning: text({
      en: 'Before you reset it, make sure through the support procedure that the person who asked is the user of this account: the system does not check it. Once reset, neither the codes of the authenticator app nor the backup codes work. The user is told by email. The devices that are signed in can still be used.',
      ja: '依頼した人が、このアカウントの利用者本人であることを、サポートの手続きで確かめてから行ってください。システムは確かめません。リセットすると、認証アプリのコードもバックアップコードも使えなくなります。利用者には、メールで知らせます。ログインしている端末は、そのまま使えます。',
    }),
    back: uiMessages.back,
    confirm: text({ en: 'Reset', ja: 'リセットする' }),
    done: (email: string) =>
      text({
        en: `Reset the two-factor authentication of ${email}. It can sign in with the password alone. The user is told by email.`,
        ja: `${email} の 2 要素認証をリセットしました。パスワードだけでログインできます。利用者には、メールで知らせます。`,
      }),
    meanwhile: text({
      en: 'Meanwhile, the two-factor authentication of this account was turned off: the user turned it off, or another administrator reset it. This is how it stands now.',
      ja: 'このアカウントの 2 要素認証は、その間に有効でなくなっていました。利用者が無効にしたか、ほかの管理者がリセットしました。いまの状態を表示しています。',
    }),
    failed: text({
      en: 'Could not reset two-factor authentication. Check your connection and try again.',
      ja: '2 要素認証をリセットできませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
