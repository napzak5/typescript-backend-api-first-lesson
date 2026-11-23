import { text } from '../../languages/localized-text'

/**
 * What the screens of the session say (`frontend/packages/session`): the
 * sign-in, the check of the session, the account in the header, and an
 * account that belongs to no salon.
 */
export const sessionMessages = {
  /** The screen, its button and the link of the header */
  signIn: text({ en: 'Sign in', ja: 'サインイン' }),
  signOut: text({ en: 'Sign out', ja: 'サインアウト' }),
  signedIn: text({ en: 'You are signed in.', ja: 'サインインしました。' }),
  signedOut: text({ en: 'You are signed out.', ja: 'サインアウトしました。' }),
  signInForm: {
    email: text({ en: 'Email address', ja: 'メールアドレス' }),
    password: text({ en: 'Password', ja: 'パスワード' }),
    rememberMe: text({
      en: 'Keep me signed in for 30 days',
      ja: '30 日間サインインしたままにする',
    }),
    rememberMeDescription: text({
      en: 'Do not choose this on a device that others use too.',
      ja: 'ほかの人も使う端末では、選ばないでください。',
    }),
    code: text({ en: 'Authentication code', ja: '認証コード' }),
    codeDescription: text({
      en: 'Enter the 6-digit code shown in your authenticator app, or a backup code.',
      ja: '認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。',
    }),
    /** From the second step back to the first */
    back: text({
      en: 'Back to the email address',
      ja: 'メールアドレスの入力に戻る',
    }),
  },
  /** What the sign-in says about an attempt */
  signInFlow: {
    passwordMissing: text({
      en: 'Enter your password.',
      ja: 'パスワードを入力してください。',
    }),
    codeMissing: text({
      en: 'Enter the authentication code.',
      ja: '認証コードを入力してください。',
    }),
    passwordRefused: text({
      en: 'Check your password and enter it again.',
      ja: 'パスワードを確かめて、入力し直してください。',
    }),
    codeRefused: text({
      en: 'Check the authentication code and enter it again.',
      ja: '認証コードを確かめて、入力し直してください。',
    }),
    wrongCredentials: text({
      en: 'The email address or the password is not correct. After 5 wrong attempts in a row, you cannot sign in for 15 minutes.',
      ja: 'メールアドレスまたはパスワードが正しくありません。続けて 5 回誤ると、15 分間サインインできなくなります。',
    }),
    wrongCode: text({
      en: 'The code is not correct. Enter a new code.',
      ja: 'コードが正しくありません。新しいコードを入力してください。',
    }),
    tooManyAttempts: text({
      en: 'There were too many attempts. Wait a while and try again.',
      ja: '試した回数が多すぎます。しばらくしてから、もう一度お試しください。',
    }),
    notStored: text({
      en: 'You cannot sign in, because this browser is set not to store the data of sites. Change the setting and try again.',
      ja: 'このブラウザーは、サイトのデータを保存しない設定のため、サインインできません。設定を変えてから、もう一度お試しください。',
    }),
    failed: text({
      en: 'Could not sign in. Check your connection and try again.',
      ja: 'サインインできませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** What stands in the place of the screens that need a session */
  sessionGate: {
    checking: text({
      en: 'Checking the sign-in',
      ja: 'サインインを確認しています',
    }),
    unavailable: text({
      en: 'The sign-in could not be checked',
      ja: 'サインインを確認できません',
    }),
    unavailableDescription: text({
      en: 'Check your connection and try again.',
      ja: '通信の状態を確かめて、もう一度お試しください。',
    }),
    tryAgain: text({ en: 'Try again', ja: 'もう一度試す' }),
    notForAccount: text({
      en: 'This application is not available',
      ja: 'このアプリケーションは利用できません',
    }),
    /** The address of the account stands in every language as it is */
    notForAccountDescription: (email: string) =>
      text({
        en: `It is not available to the account ${email}. Sign in again with an account that can use it.`,
        ja: `${email} のアカウントでは利用できません。利用できるアカウントでサインインし直してください。`,
      }),
  },
  noSalon: {
    title: text({
      en: 'You do not belong to any salon',
      ja: 'どのサロンにも属していません',
    }),
    description: text({
      en: 'This account is not on the staff of any salon now. Once you join a salon from the link in its mail of invitation, you can use the screens of the salon.',
      ja: 'このアカウントは、いま、どのサロンのスタッフにもなっていません。サロンから招待のメールを受け取り、そのリンクから参加すると、サロンの画面を使えるようになります。',
    }),
  },
}
