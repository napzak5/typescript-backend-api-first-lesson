import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'

/** What follows a wrong password or code: the API locks the sign-in after a few */
const LOCK = text({
  en: 'After 5 wrong attempts in a row, you cannot sign in either for 15 minutes.',
  ja: '5 回続けて違うと、15 分間、サインインもできなくなります。',
})

/** A sentence, then the lock */
const thenLock = (sentence: LocalizedText): LocalizedText =>
  text({ en: `${sentence.en} ${LOCK.en}`, ja: `${sentence.ja}${LOCK.ja}` })

/** A password of at least `least` characters, as a sentence asks for one */
const atLeast = (least: number): LocalizedText =>
  text({
    en: `Enter ${numberOf(least).en} characters or more.`,
    ja: `${numberOf(least).ja} 文字以上で入力してください。`,
  })

const ACCOUNT_SECURITY = text({
  en: 'Account security',
  ja: 'アカウントの安全',
})

const TURN_OFF = text({
  en: 'Turn off two-factor authentication',
  ja: '2 要素認証を無効にする',
})

const ISSUE_BACKUP_CODES = text({
  en: 'Issue new backup codes',
  ja: 'バックアップコードを発行し直す',
})

/**
 * What the screens of the security of an account say
 * (`frontend/packages/session/src/security`): the password and its rule,
 * the second factor, and the devices that are signed in.
 */
export const securityMessages = {
  /** The screen, and the link of the header that leads to it */
  accountSecurity: ACCOUNT_SECURITY,
  description: text({
    en: 'Your password, two-factor authentication and the devices this account is signed in on.',
    ja: 'パスワードと 2 要素認証、このアカウントでサインインしている端末です。',
  }),
  backToSecurity: text({
    en: 'Back to account security',
    ja: 'アカウントの安全へ戻る',
  }),
  /** The way back out of a form */
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  loadingAccount: text({
    en: 'Loading the account',
    ja: 'アカウントを読み込んでいます',
  }),
  /**
   * What the sentences of another catalogue speak of (what was not read:
   * `answerMessages.unread`), written as it stands inside such a sentence
   */
  names: {
    account: text({ en: 'the account', ja: 'アカウント' }),
    devices: text({
      en: 'the signed-in devices',
      ja: 'サインインしている端末',
    }),
  },
  password: {
    title: text({ en: 'Password', ja: 'パスワード' }),
    lastChanged: text({ en: 'Last changed', ja: '最後に変更した日時' }),
    neverChanged: text({
      en: 'Not changed since the account was created',
      ja: 'アカウントを作ってから、変更していません',
    }),
    /** The link, the screen and its button */
    change: text({ en: 'Change the password', ja: 'パスワードを変更する' }),
    changeDescription: text({
      en: 'When you change it, every device but this one is signed out.',
      ja: '変更すると、この端末のほかは、すべての端末でサインアウトします。',
    }),
    changed: text({
      en: 'Your password is changed. Every device but this one is signed out. We have emailed you about the change.',
      ja: 'パスワードを変更しました。この端末のほかは、すべての端末でサインアウトしました。変更したことを、メールでお知らせしました。',
    }),
    current: text({ en: 'Current password', ja: '現在のパスワード' }),
    new: text({ en: 'New password', ja: '新しいパスワード' }),
    currentMissing: text({
      en: 'Enter the current password.',
      ja: '現在のパスワードを入力してください。',
    }),
    currentWrong: thenLock(
      text({
        en: 'The current password is not correct.',
        ja: '現在のパスワードが違います。',
      }),
    ),
    unchanged: text({
      en: 'This is the current password. Enter another password.',
      ja: '現在のパスワードと同じです。別のパスワードを入力してください。',
    }),
  },
  /** The rule of a password that a person chooses, and what is said of one that breaks it */
  passwordRule: {
    rule: (least: number) =>
      text({
        en: `${atLeast(least).en} A long sentence, or several words together, is safe.`,
        ja: `${atLeast(least).ja}長い文や、いくつかの単語の組み合わせが安全です。`,
      }),
    missing: text({
      en: 'Enter a password.',
      ja: 'パスワードを入力してください。',
    }),
    tooShort: (least: number) =>
      text({
        en: `The password is too short. ${atLeast(least).en}`,
        ja: `パスワードが短すぎます。${atLeast(least).ja}`,
      }),
    tooLong: (most: number) =>
      text({
        en: `The password is too long. Enter ${numberOf(most).en} characters or fewer.`,
        ja: `パスワードが長すぎます。${numberOf(most).ja} 文字以下で入力してください。`,
      }),
    guessable: text({
      en: 'This password is easy to guess and cannot be used. Enter another password.',
      ja: 'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
    }),
    refused: text({
      en: 'This password cannot be used. Enter another password.',
      ja: 'このパスワードは使えません。別のパスワードを入力してください。',
    }),
  },
  twoFactor: {
    title: text({ en: 'Two-factor authentication', ja: '2 要素認証' }),
    state: text({ en: 'Status', ja: '状態' }),
    enabled: text({ en: 'On', ja: '有効' }),
    enabledDescription: text({
      en: 'When you sign in, the code your authenticator app shows is checked as well as the password.',
      ja: 'サインインのときに、パスワードに加えて、認証アプリが表示するコードを確かめます。',
    }),
    pending: text({ en: 'Set-up not finished', ja: '設定の途中' }),
    pendingDescription: text({
      en: 'The set-up was begun, but no code of the authenticator app has confirmed it. No code is asked for when you sign in.',
      ja: '設定を始めましたが、認証アプリのコードで確かめていません。サインインのときに、コードは求められません。',
    }),
    disabled: text({ en: 'Not set up', ja: '未設定' }),
    disabledDescription: text({
      en: 'When you sign in, only the password is checked. When the code of an authenticator app is checked too, nobody can sign in with your password alone.',
      ja: 'サインインのときに確かめるのは、パスワードだけです。認証アプリのコードも確かめると、パスワードが知られても、サインインされません。',
    }),
    /** The link, and the screen it leads to */
    setUp: text({
      en: 'Set up two-factor authentication',
      ja: '2 要素認証を設定する',
    }),
    setUpAgain: text({ en: 'Set up again', ja: '設定をやり直す' }),
    issueBackupCodes: ISSUE_BACKUP_CODES,
    turnOff: TURN_OFF,
    setUpDescription: text({
      en: 'When you sign in, the code that the authenticator app of your smartphone shows is checked as well as the password. Nobody can sign in with your password alone.',
      ja: 'サインインのときに、パスワードに加えて、スマートフォンの認証アプリが表示するコードを確かめるようにします。パスワードが知られても、サインインされません。',
    }),
    alreadyOn: text({
      en: 'Two-factor authentication is on already',
      ja: '2 要素認証は、すでに有効です',
    }),
    alreadyOnDescription: text({
      en: 'You can issue new backup codes and turn off two-factor authentication on the account security screen.',
      ja: 'バックアップコードの発行し直しと、2 要素認証を無効にすることは、アカウントの安全の画面でできます。',
    }),
    confirmPassword: text({
      en: 'Confirm your password',
      ja: 'パスワードを確かめる',
    }),
    passwordDescription: text({
      en: 'The password of this account. It confirms that it is the owner of the account who sets this up.',
      ja: 'このアカウントのパスワードです。設定するのが、アカウントの持ち主であることを確かめます。',
    }),
    begin: text({ en: 'Begin the set-up', ja: '設定を始める' }),
    register: text({
      en: 'Register with the authenticator app',
      ja: '認証アプリに登録する',
    }),
    scan: text({
      en: 'Scan this QR code with the authenticator app of your smartphone (one that supports TOTP).',
      ja: 'スマートフォンの認証アプリ（TOTP に対応したもの）で、この QR コードを読み取ってください。',
    }),
    qrCode: text({
      en: 'QR code for the authenticator app',
      ja: '認証アプリで読み取る QR コード',
    }),
    key: text({
      en: 'If you cannot scan the QR code, enter this key in the authenticator app.',
      ja: 'QR コードを読み取れないときは、このキーを認証アプリに入力してください。',
    }),
    confirmCode: text({ en: 'Confirm the code', ja: 'コードを確かめる' }),
    turnOn: text({
      en: 'Turn on two-factor authentication',
      ja: '2 要素認証を有効にする',
    }),
    appCode: text({
      en: 'Code of the authenticator app',
      ja: '認証アプリのコード',
    }),
    appCodeDescription: text({
      en: 'The 6 digits the authenticator app shows. A backup code cannot be used here.',
      ja: '認証アプリに表示されている 6 桁の数字です。バックアップコードは使えません。',
    }),
    turnedOn: text({
      en: 'Two-factor authentication is on',
      ja: '2 要素認証を有効にしました',
    }),
    turnedOnDescription: text({
      en: 'From your next sign-in, the code of the authenticator app is checked as well as the password. We have emailed you about the change.',
      ja: '次のサインインから、パスワードに加えて、認証アプリのコードを確かめます。有効にしたことを、メールでお知らせしました。',
    }),
    backupCodesDescription: text({
      en: 'These backup codes are for when you cannot use the authenticator app. Each can be used once in place of a code of the authenticator app. They are never shown again once you leave this screen. Print them, or keep them in a safe place such as a password manager. If you lose them, you can issue new ones on the account security screen with a code of the authenticator app.',
      ja: '認証アプリを使えないときのための、バックアップコードです。それぞれ 1 回だけ、認証アプリのコードの代わりに使えます。この画面を離れると、二度と表示されません。印刷するか、パスワードマネージャーなどの安全な場所に控えてください。控えをなくしたときは、認証アプリのコードで、アカウントの安全の画面から発行し直せます。',
    }),
    backupCodes: text({ en: 'Backup codes', ja: 'バックアップコード' }),
    turnedOff: text({
      en: 'Two-factor authentication is off. When you sign in, only the password is checked now. We have emailed you about the change.',
      ja: '2 要素認証を無効にしました。サインインのときに確かめるのは、パスワードだけになりました。無効にしたことを、メールでお知らせしました。',
    }),
    changedElsewhere: text({
      en: 'Two-factor authentication was changed on another screen or device. Its state has been loaded again.',
      ja: '2 要素認証の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。',
    }),
  },
  /** The dialog that turns the second factor off */
  turnOff: {
    title: text({
      en: 'Turn off two-factor authentication?',
      ja: '2 要素認証を無効にしますか？',
    }),
    description: text({
      en: 'When it is off, only the password is checked when you sign in. The password and a code of the authenticator app or a backup code confirm that you are the owner of the account.',
      ja: '無効にすると、サインインのときに確かめるのは、パスワードだけになります。アカウントの持ち主であることを、パスワードと、認証アプリのコードかバックアップコードで確かめます。',
    }),
    submit: text({ en: 'Turn off', ja: '無効にする' }),
    code: text({
      en: 'Code of the authenticator app or backup code',
      ja: '認証アプリのコードかバックアップコード',
    }),
    codeDescription: text({
      en: 'The 6-digit code the authenticator app shows, or a backup code that was not used yet.',
      ja: '認証アプリに表示されている 6 桁のコードか、まだ使っていないバックアップコードです。',
    }),
  },
  /** The dialog that issues new backup codes */
  issue: {
    title: ISSUE_BACKUP_CODES,
    description: text({
      en: 'Issues 10 new backup codes. The backup codes you have now can no longer be used.',
      ja: '新しいバックアップコードを 10 個発行します。いまのバックアップコードは、使えなくなります。',
    }),
    submit: text({ en: 'Issue', ja: '発行し直す' }),
    issued: text({
      en: 'These are your new backup codes. The backup codes before them can no longer be used. Each can be used once in place of a code of the authenticator app. They are never shown again once you close this dialog. Print them, or keep them in a safe place such as a password manager. We have emailed you about the new codes.',
      ja: '新しいバックアップコードです。それまでのバックアップコードは、使えなくなりました。それぞれ 1 回だけ、認証アプリのコードの代わりに使えます。このダイアログを閉じると、二度と表示されません。印刷するか、パスワードマネージャーなどの安全な場所に控えてください。発行し直したことを、メールでお知らせしました。',
    }),
    codeDescription: text({
      en: 'It confirms that you are the owner of the account. Enter the 6-digit code the authenticator app shows, or a backup code that was not used yet.',
      ja: 'アカウントの持ち主であることを確かめます。認証アプリに表示されている 6 桁のコードか、まだ使っていないバックアップコードを入力してください。',
    }),
  },
  /** What the forms of the second factor say of what was entered */
  twoFactorFlow: {
    passwordMissing: text({
      en: 'Enter your password.',
      ja: 'パスワードを入力してください。',
    }),
    passwordWrong: thenLock(
      text({
        en: 'The password is not correct.',
        ja: 'パスワードが違います。',
      }),
    ),
    appCodeMissing: text({
      en: 'Enter the 6-digit code the authenticator app shows.',
      ja: '認証アプリに表示されている 6 桁のコードを入力してください。',
    }),
    appCodeMalformed: text({
      en: 'The code has 6 digits. Enter the code the authenticator app shows now.',
      ja: 'コードは 6 桁の数字です。認証アプリに表示されている、いまのコードを入力してください。',
    }),
    appCodeWrong: thenLock(
      text({
        en: 'The code is not correct. Enter the code the authenticator app shows now.',
        ja: 'コードが違います。認証アプリに表示されている、いまのコードを入力してください。',
      }),
    ),
    codeMissing: text({
      en: 'Enter the 6-digit code the authenticator app shows, or a backup code.',
      ja: '認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。',
    }),
    codeTooLong: text({
      en: 'The code is too long. Enter the 6-digit code of the authenticator app, or a backup code.',
      ja: 'コードが長すぎます。認証アプリの 6 桁のコードか、バックアップコードを入力してください。',
    }),
    codeWrong: thenLock(
      text({
        en: 'The code is not correct, or it is a backup code that was used already.',
        ja: 'コードが違うか、使ったことのあるバックアップコードです。',
      }),
    ),
  },
  /** The devices the account is signed in on */
  sessions: {
    title: text({ en: 'Signed-in devices', ja: 'サインインしている端末' }),
    description: text({
      en: 'The devices this account is signed in on. Sign out any device you do not know, or no longer use.',
      ja: 'このアカウントでサインインしている端末です。心当たりのない端末や、使わなくなった端末は、サインアウトさせてください。',
    }),
    loading: text({
      en: 'Loading the signed-in devices',
      ja: 'サインインしている端末を読み込んでいます',
    }),
    /** How many devices the account is signed in on, as the count of the list says it */
    signedInOn: (count: number) =>
      text({
        en: `Signed in on ${numberOf(count).en} ${count === 1 ? 'device' : 'devices'}`,
        ja: `${numberOf(count).ja} 台の端末でサインインしています`,
      }),
    /** A device, by when it signed in */
    name: (signedIn: LocalizedText) =>
      text({
        en: `Device signed in on ${signedIn.en}`,
        ja: `${signedIn.ja} にサインインした端末`,
      }),
    thisDevice: text({ en: 'This device', ja: 'この端末' }),
    browser: text({ en: 'Browser', ja: 'ブラウザー' }),
    ipAddress: text({ en: 'IP address', ja: 'IP アドレス' }),
    lastUsed: text({ en: 'Last used', ja: '最後に使われた日時' }),
    expires: text({ en: 'Sign-in expires', ja: 'サインインが切れる日時' }),
    notRecorded: text({ en: 'Not recorded', ja: '記録されていません' }),
    signOut: text({ en: 'Sign out', ja: 'サインアウトさせる' }),
    /** The button of a device, by its name */
    signOutOf: (signedIn: LocalizedText) =>
      text({
        en: `Sign out the device signed in on ${signedIn.en}`,
        ja: `${signedIn.ja} にサインインした端末をサインアウトさせる`,
      }),
    signedOut: text({
      en: 'The device is signed out. To use it again, sign in on it.',
      ja: '端末をサインアウトさせました。その端末で使うには、もう一度サインインが必要です。',
    }),
  },
  /** The way to sign out everywhere at once */
  everywhere: {
    button: text({
      en: 'Sign out on every device',
      ja: 'すべての端末でサインアウトする',
    }),
    title: text({
      en: 'Sign out on every device?',
      ja: 'すべての端末でサインアウトしますか？',
    }),
    description: text({
      en: 'This ends every sign-in of this account, on this device too. To go on, sign in again.',
      ja: 'この端末も含めて、このアカウントでサインインしている端末の、すべてのサインインを終わらせます。続けて使うには、もう一度サインインしてください。',
    }),
    confirm: text({ en: 'Sign out', ja: 'サインアウトする' }),
    signedOut: text({
      en: 'You are signed out on every device.',
      ja: 'すべての端末でサインアウトしました。',
    }),
  },
}
