import { type LocalizedText, text } from '../../languages/localized-text'
import { customerMessages as record } from '../ui/customers'
import { listed, postalCodeOf } from '../written'

const YOUR_DETAILS = text({ en: 'Your details', ja: 'お客様の情報' })

/**
 * What the record of a customer says in the portal: the page of the
 * customer with what the salons keep of a member, the profile with its
 * form, and the controls that the form and the first booking of a new
 * customer share. What the customer wrote (the name, the address) is shown
 * as it was written.
 */
export const portalProfileMessages = {
  /** The controls of the form of a profile, and the terms its record is shown with */
  controls: {
    lastName: record.lastName,
    firstName: record.firstName,
    lastNameKana: record.lastNameKana,
    firstNameKana: record.firstNameKana,
    phoneNumber: record.phoneNumber,
    phoneNumberDescription: text({
      en: 'The salon may contact you about your booking.',
      ja: 'ご予約について、サロンから連絡することがあります。',
    }),
    alternativePhone: record.alternativePhone,
    alternativePhoneDescription: text({
      en: 'The number the salon calls when the one above does not answer.',
      ja: '上の番号につながらないときに、連絡する番号です。',
    }),
    postalCode: record.postalCode,
    prefecture: record.prefecture,
    city: record.city,
    address: record.address,
    building: record.building,
    birthDate: record.birthDate,
    gender: record.gender,
    /** The first choice of the gender, which says none */
    noGender: text({ en: 'Not specified', ja: '選択しない' }),
    occupation: record.occupation,
    preferredServices: record.preferredServices,
    notes: text({
      en: 'Notes for the salon',
      ja: 'サロンに伝えておきたいこと',
    }),
    notesDescription: text({
      en: 'For example, the products you would like used, or what you do not like.',
      ja: '使ってほしい製品や、苦手なことなどを書いてください。',
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
  /** The parts of the form of a profile */
  parts: {
    name: record.parts.name,
    contact: record.parts.contact,
    address: record.parts.address,
    aboutYou: text({ en: 'About you', ja: 'ご本人について' }),
    likes: text({ en: 'What you like', ja: '好み' }),
    contacts: text({ en: 'Messages you receive', ja: '受け取る連絡' }),
  },
  /** What the form says of the address of mail, which it does not change */
  email: {
    ofNewProfile: text({
      en: 'The email address you sign in with is registered.',
      ja: 'メールアドレスは、サインインに使っているものを登録します。',
    }),
    unchangeable: (email: string) =>
      text({
        en: `Your email address (${email}) cannot be changed here. To change it, contact the salon.`,
        ja: `メールアドレス（${email}）は、ここでは変更できません。変更するときは、サロンにお問い合わせください。`,
      }),
  },
  /** The record of a profile, as the customer reads it */
  details: {
    kana: record.kana,
    email: record.email,
    /** The postal code of the address: 「〒150-0001」 */
    postalCode: postalCodeOf,
    /** The entries of a list (the favorite services, the messages received): 「カット、カラー」 */
    listed: (entries: readonly LocalizedText[]) => listed(entries),
    byEmail: record.byEmail,
    bySms: record.bySms,
    marketing: record.marketing,
  },
  /** What the salons keep of a member, which the customer cannot change */
  membership: {
    title: text({ en: 'Membership', ja: '会員の情報' }),
    tier: record.membershipTier,
    points: record.points,
    pointsOf: record.pointsOf,
    visits: record.visits,
    visitsOf: record.visitsOf,
    firstVisit: text({ en: 'First visit', ja: '初めての来店' }),
    lastVisit: text({ en: 'Last visit', ja: '最後の来店' }),
    /** What stands where a day would, for a customer who has not come yet */
    noVisit: text({ en: 'No visits yet', ja: 'まだ来店がありません' }),
    referralCode: record.referralCode,
    notIssued: record.notIssued,
    hairType: record.hairType,
    hairThickness: record.hairThickness,
    scalpCondition: record.scalpCondition,
  },
  /** The page of the customer */
  myPage: {
    signInNotice: text({
      en: 'Sign in to see your page.',
      ja: 'マイページを見るには、サインインしてください。',
    }),
    profile: YOUR_DETAILS,
    change: text({
      en: 'Change your details',
      ja: 'お客様の情報を変更する',
    }),
    reviews: text({ en: 'Reviews', ja: 'レビュー' }),
    reviewsDescription: text({
      en: 'Check, change and remove the reviews you wrote of the salons you visited.',
      ja: '来店したサロンに書いたレビューを確かめ、変更し、削除できます。',
    }),
    toReviews: text({ en: 'See your reviews', ja: '自分のレビューを見る' }),
    none: text({
      en: 'Your details are not registered yet',
      ja: 'お客様の情報は、まだ登録されていません',
    }),
    noneDescription: text({
      en: 'Register your name and phone number to book a salon. Your membership is shown here too.',
      ja: 'お名前と電話番号を登録すると、サロンを予約できます。会員の情報も、ここに表示されます。',
    }),
    register: text({
      en: 'Register your details',
      ja: 'お客様の情報を登録する',
    }),
    securityDescription: text({
      en: 'Change your password, and check the devices signed in to this account.',
      ja: 'パスワードの変更と、このアカウントでサインインしている端末の確認ができます。',
    }),
    toSecurity: text({
      en: 'Check the security of your account',
      ja: 'アカウントの安全を確かめる',
    }),
  },
  /** The screen of the form of a profile */
  profile: {
    title: YOUR_DETAILS,
    signInNotice: text({
      en: 'Sign in to register or change your details.',
      ja: 'お客様の情報を登録、変更するには、サインインしてください。',
    }),
    loading: text({
      en: 'Loading your details',
      ja: 'お客様の情報を読み込んでいます',
    }),
    newDescription: text({
      en: 'Your name and phone number are needed to book a salon. You can register the rest later.',
      ja: 'お名前と電話番号は、サロンを予約するために必要です。そのほかの項目は、あとからでも登録できます。',
    }),
    register: text({ en: 'Register', ja: '登録する' }),
    registered: text({
      en: 'Your details were registered.',
      ja: 'お客様の情報を登録しました。',
    }),
    changed: text({
      en: 'Your details were changed.',
      ja: 'お客様の情報を変更しました。',
    }),
    gone: text({
      en: 'Your details were not found, so the changes could not be saved. Please register them again.',
      ja: 'お客様の情報が見つからなかったため、変更を保存できませんでした。お手数ですが、もう一度登録してください。',
    }),
    refused: text({
      en: 'Your details could not be registered with this account. If reloading the page does not help, contact the salon.',
      ja: 'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
    }),
  },
  /** The names that the sentences of other catalogues put in theirs (what was not read) */
  names: {
    profile: text({ en: 'your details', ja: 'お客様の情報' }),
  },
}
