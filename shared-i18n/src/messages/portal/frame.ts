import { text } from '../../languages/localized-text'

/**
 * What the frame of the portal says: the links of the header, the ways on
 * under the sign-in form, and the screens of the security of an account,
 * which the portal puts below the page of the customer.
 */
export const portalFrameMessages = {
  /** The links of the header of a customer */
  navigation: {
    search: text({ en: 'Find a salon', ja: 'サロンを探す' }),
    bookings: text({ en: 'Your bookings', ja: '予約の一覧' }),
    myPage: text({ en: 'My page', ja: 'マイページ' }),
  },
  /** Under the sign-in form: the way to an account of one's own */
  firstTimeWithLink: {
    before: text({ en: 'New here? ', ja: 'はじめての方は、' }),
    link: text({ en: 'Create an account', ja: 'アカウントを登録' }),
    after: text({ en: '.', ja: 'してください。' }),
  },
  /** The security of the account of a customer */
  security: {
    signInNotice: text({
      en: 'Sign in to check the security of your account.',
      ja: 'アカウントの安全を確かめるには、サインインしてください。',
    }),
    passwordSignInNotice: text({
      en: 'Sign in to change your password.',
      ja: 'パスワードを変更するには、サインインしてください。',
    }),
    twoFactorSignInNotice: text({
      en: 'Sign in to set up two-factor authentication.',
      ja: '2 要素認証を設定するには、サインインしてください。',
    }),
    backToMyPage: text({ en: 'Back to my page', ja: 'マイページへ戻る' }),
  },
}
