import { text } from '../../languages/localized-text'

/**
 * What the screens of an account in the portal say
 * (`frontend/apps/portal-app/src/account/`): registering, the address
 * confirmed by a mailed link, a new password, and the invitation to the
 * staff of a salon. A sentence with links in it is written in its parts,
 * which a screen puts around the links (`…WithLink`, `…WithLinks`).
 */
export const portalAccountMessages = {
  /** The button that leads to the sign-in once an account can be used */
  signIn: text({ en: 'Sign in', ja: 'サインインする' }),
  /** A screen that a mailed link opens */
  mailedLink: {
    checking: text({ en: 'Checking the link', ja: 'リンクを確かめています' }),
    checkAgain: text({ en: 'Check again', ja: 'もう一度確かめる' }),
    unusable: text({
      en: 'This link cannot be used',
      ja: 'このリンクは使えません',
    }),
  },
  register: {
    title: text({ en: 'Create an account', ja: 'アカウントの登録' }),
    description: text({
      en: 'Register your email address and a password to book and to see your bookings.',
      ja: 'メールアドレスとパスワードを登録すると、予約やその確認ができるようになります。',
    }),
    submit: text({ en: 'Register', ja: '登録する' }),
    emailDescription: text({
      en: 'We will send you a mail to confirm it.',
      ja: '確認のメールをお送りします。',
    }),
    haveAccountWithLink: {
      before: text({
        en: 'Already have an account? ',
        ja: 'すでにアカウントをお持ちの方は、',
      }),
      link: text({ en: 'Sign in', ja: 'サインイン' }),
      after: text({ en: '.', ja: 'してください。' }),
    },
  },
  /** What a person reads once the mail that confirms an address is asked for */
  verificationSent: {
    title: text({
      en: 'We sent you a confirmation mail',
      ja: '確認メールを送りました',
    }),
    sentTo: (email: string) =>
      text({
        en: `We sent a confirmation mail to ${email}. Open its link to finish the registration. The link works for 24 hours.`,
        ja: `${email} に、確認メールを送りました。メールのリンクを開くと、登録が完了します。リンクは 24 時間有効です。`,
      }),
    notArrivedWithLinks: {
      before: text({
        en: 'If the mail does not arrive, check your spam folder. No confirmation mail is sent to an address that already has an account. In that case, ',
        ja: 'メールが届かないときは、迷惑メールのフォルダーをお確かめください。すでにアカウントのあるメールアドレスには、確認メールは届きません。その場合は、',
      }),
      signIn: text({ en: 'sign in', ja: 'サインイン' }),
      between: text({ en: ' or ', ja: 'するか、' }),
      reset: text({ en: 'set a new password', ja: 'パスワードを再設定' }),
      after: text({ en: '.', ja: 'してください。' }),
    },
    sendAgain: text({
      en: 'Send the confirmation mail again',
      ja: '確認メールをもう一度送る',
    }),
    sentAgain: text({
      en: 'We will send the confirmation mail again. Wait a while for it to arrive.',
      ja: '確認メールの再送を受け付けました。届くまで、しばらくお待ちください。',
    }),
    oncePerMinute: text({
      en: 'You can send it once a minute at most.',
      ja: '続けて送れるのは、1 分に 1 回までです。',
    }),
  },
  /** Where the link of the mail that confirms an address leads */
  verifyEmail: {
    title: text({
      en: 'Confirm your email address',
      ja: 'メールアドレスの確認',
    }),
    description: text({
      en: 'Press the button to confirm your email address and start using your account.',
      ja: 'ボタンを押すと、メールアドレスの確認が済み、アカウントを使えるようになります。',
    }),
    confirm: text({
      en: 'Confirm the email address',
      ja: 'メールアドレスを確認する',
    }),
    confirmed: text({
      en: 'Your email address is confirmed',
      ja: 'メールアドレスを確認しました',
    }),
    confirmedDescription: text({
      en: 'Your registration is complete. Sign in with the email address and the password you registered.',
      ja: '登録が完了しました。登録したメールアドレスとパスワードでサインインしてください。',
    }),
    send: text({ en: 'Send a confirmation mail', ja: '確認メールを送る' }),
    emailDescription: text({
      en: 'We will send the confirmation mail again to the email address you registered.',
      ja: '登録したメールアドレスに、確認メールをもう一度お送りします。',
    }),
    alreadyConfirmedWithLink: {
      before: text({
        en: 'If your address is confirmed already, you can ',
        ja: '確認がすでに済んでいれば、そのまま',
      }),
      link: text({ en: 'sign in', ja: 'サインイン' }),
      after: text({ en: '.', ja: 'できます。' }),
    },
    expired: text({
      en: 'The link has expired (it works for 24 hours) or has been used. We will send you a new one.',
      ja: 'リンクの有効期間（24 時間）が過ぎたか、すでに使われています。新しいリンクをお送りします。',
    }),
    noLink: text({
      en: 'Open this page from the link of the confirmation mail. If you cannot find the mail, we will send you a new link.',
      ja: 'このページは、確認メールのリンクから開いてください。メールが見つからないときは、新しいリンクをお送りします。',
    }),
  },
  /** Where a password is set anew: the mail asked for, and the screen its link opens */
  passwordReset: {
    title: text({ en: 'Set a new password', ja: 'パスワードの再設定' }),
    description: text({
      en: 'We will send a link to set a new password to the email address you registered.',
      ja: '登録したメールアドレスに、パスワードを再設定するためのリンクをお送りします。',
    }),
    send: text({ en: 'Send the mail', ja: '再設定のメールを送る' }),
    sent: text({
      en: 'We sent you a mail to set a new password',
      ja: '再設定のメールを送りました',
    }),
    sentTo: (email: string) =>
      text({
        en: `If ${email} has an account, we sent it a mail to set a new password. Open the link of the mail and choose a new password. The link works for 30 minutes.`,
        ja: `${email} のアカウントがあれば、パスワードを再設定するためのメールを送りました。メールのリンクを開いて、新しいパスワードを決めてください。リンクは 30 分間有効です。`,
      }),
    notArrived: text({
      en: 'If the mail does not arrive, check your spam folder and the email address you entered. You can send it once a minute at most.',
      ja: 'メールが届かないときは、迷惑メールのフォルダーと、入力したメールアドレスをお確かめください。続けて送れるのは、1 分に 1 回までです。',
    }),
    backToSignIn: text({
      en: 'Back to the sign-in',
      ja: 'サインインの画面に戻る',
    }),
    chooseNew: text({
      en: 'Choose a new password.',
      ja: '新しいパスワードを決めてください。',
    }),
    changed: text({
      en: 'Your password is changed',
      ja: 'パスワードを変更しました',
    }),
    changedDescription: text({
      en: 'This account is signed out on every device. Sign in with the new password.',
      ja: 'このアカウントは、すべての端末でサインアウトされました。新しいパスワードでサインインしてください。',
    }),
    sendAgain: text({
      en: 'Send the mail again',
      ja: '再設定のメールをもう一度送る',
    }),
    expired: text({
      en: 'The link has expired (it works for 30 minutes) or has been used. We will send you the mail again.',
      ja: 'リンクの有効期間（30 分）が過ぎたか、すでに使われています。再設定のメールを、もう一度お送りします。',
    }),
    noLink: text({
      en: 'Open this page from the link of the mail. If you cannot find the mail, we will send it again.',
      ja: 'このページは、再設定のメールのリンクから開いてください。メールが見つからないときは、もう一度お送りします。',
    }),
  },
  /** Where the link of an invitation to the staff of a salon leads */
  invitation: {
    title: text({
      en: 'Invitation to a staff account',
      ja: 'スタッフアカウントへの招待',
    }),
    role: text({ en: 'Role', ja: '役割' }),
    expiresAt: text({ en: 'Invitation expires', ja: '招待の期限' }),
    createDescription: text({
      en: 'Choose a password to make an account that signs in to the screens for salons.',
      ja: 'パスワードを決めると、店舗向けの画面にサインインするアカウントができます。',
    }),
    create: text({ en: 'Create the account', ja: 'アカウントを作る' }),
    created: text({
      en: 'Your account is created',
      ja: 'アカウントを作りました',
    }),
    createdDescription: text({
      en: 'Sign in to the screens for salons with the email address of the invitation and the password you have just chosen.',
      ja: '招待のメールアドレスと、いま決めたパスワードで、店舗向けの画面にサインインしてください。',
    }),
    /** Why the sign-in is asked for, and with which account */
    signInNotice: (email: string) =>
      text({
        en: `This invitation is for the staff account of ${email}. Sign in with that account.`,
        ja: `この招待は、${email} のスタッフのアカウントで受けられます。そのアカウントでサインインしてください。`,
      }),
    joinDescription: text({
      en: 'Accept this invitation with the account you are signed in with. Your password stays as it is.',
      ja: 'サインインしているアカウントで、この招待を受けます。パスワードは、いまのものをそのまま使います。',
    }),
    join: text({ en: 'Accept the invitation', ja: '招待を受ける' }),
    notForThisAccount: (email: string) =>
      text({
        en: `You cannot accept this invitation with the account you are signed in with. Sign in again with the staff account of ${email}.`,
        ja: `サインインしているアカウントでは、この招待を受けられません。${email} のスタッフのアカウントでサインインし直してください。`,
      }),
    joined: text({
      en: 'You accepted the invitation',
      ja: '招待を受けました',
    }),
    joinedDescription: text({
      en: 'You can now use the screens for salons with this account.',
      ja: 'このアカウントで、店舗向けの画面を使えるようになりました。',
    }),
    toAdmin: text({
      en: 'Open the screens for salons',
      ja: '店舗向けの画面を開く',
    }),
    accountExists: text({
      en: 'The invited email address already has an account, so this invitation cannot be used. Contact the salon that sent it.',
      ja: '招待されたメールアドレスには、すでにアカウントがあり、この招待は使えません。招待を送ったサロンに、お問い合わせください。',
    }),
    expired: text({
      en: 'The invitation has expired (it is valid for 7 days), has been used or has been withdrawn. Ask the salon that sent it to invite you again.',
      ja: '招待の期限（7 日）が過ぎたか、すでに使われたか、取り消されています。招待を送ったサロンに、もう一度招待するよう、お伝えください。',
    }),
    noLink: text({
      en: 'Open this page from the link of the invitation mail.',
      ja: 'このページは、招待のメールのリンクから開いてください。',
    }),
  },
}
