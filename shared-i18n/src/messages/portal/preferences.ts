import { text } from '../../languages/localized-text'

/**
 * What the screens of the preferences of a customer say in the portal: the
 * part of the page of the customer, and the screen of the form. The form
 * and the record say what the shared package of the preferences says.
 */
export const portalPreferenceMessages = {
  title: text({ en: 'Preferences', ja: '好みの設定' }),
  loading: text({
    en: 'Loading your preferences',
    ja: '好みの設定を読み込んでいます',
  }),
  change: text({
    en: 'Change your preferences',
    ja: '好みの設定を変更する',
  }),
  /** What the part of the page says to an account that lost its profile since the page was read */
  withoutProfile: text({
    en: 'You can set your preferences once your details are registered.',
    ja: '好みの設定は、お客様の情報を登録すると使えます。',
  }),
  /** The same, as the title of the screen of the form */
  withoutProfileTitle: text({
    en: 'You can set your preferences once your details are registered',
    ja: '好みの設定は、お客様の情報を登録すると使えます',
  }),
  withoutProfileDescription: text({
    en: 'Register your name and phone number, then try again.',
    ja: 'お名前と電話番号を登録してから、もう一度お試しください。',
  }),
  signInNotice: text({
    en: 'Sign in to change your preferences.',
    ja: '好みの設定を変更するには、サインインしてください。',
  }),
  changed: text({
    en: 'Your preferences were changed.',
    ja: '好みの設定を変更しました。',
  }),
  gone: text({
    en: 'Your details were not found, so the changes could not be saved.',
    ja: 'お客様の情報が見つからなかったため、変更を保存できませんでした。',
  }),
  /** The names that the sentences of other catalogues put in theirs (what was not read) */
  names: {
    preferences: text({ en: 'your preferences', ja: '好みの設定' }),
  },
}
