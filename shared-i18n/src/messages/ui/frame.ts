import { text } from '../../languages/localized-text'

/**
 * What the frame of an application says (`frontend/packages/app-frame`):
 * the screen of an address that is none, and the way on from the sign-in of
 * an application for the staff.
 */
export const frameMessages = {
  notFound: {
    title: text({ en: 'Page not found', ja: 'ページが見つかりません' }),
    description: text({
      en: 'Check that the address is correct.',
      ja: 'アドレスが正しいか、お確かめください。',
    }),
    back: text({ en: 'Back to the top', ja: 'トップへ戻る' }),
  },
  /** The link under the sign-in form, to the portal, where a password is set anew */
  forgotPassword: text({
    en: 'Forgot your password?',
    ja: 'パスワードを忘れた場合',
  }),
}
