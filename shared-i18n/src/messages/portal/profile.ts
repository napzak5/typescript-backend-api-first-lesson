import { text } from '../../languages/localized-text'

/**
 * What the record of a customer says in the portal: the controls that the
 * form of the profile and the first booking of a new customer share.
 */
export const portalProfileMessages = {
  controls: {
    lastName: text({ en: 'Last name', ja: '姓' }),
    firstName: text({ en: 'First name', ja: '名' }),
    phoneNumber: text({ en: 'Phone number', ja: '電話番号' }),
    phoneNumberDescription: text({
      en: 'The salon may contact you about your booking.',
      ja: 'ご予約について、サロンから連絡することがあります。',
    }),
    allowEmail: text({
      en: 'Receive messages by email',
      ja: 'メールでの連絡を受け取る',
    }),
    allowSms: text({
      en: 'Receive messages by SMS',
      ja: 'SMS での連絡を受け取る',
    }),
    allowMarketing: text({
      en: 'Receive news such as campaigns',
      ja: 'キャンペーンなどのお知らせを受け取る',
    }),
  },
}
