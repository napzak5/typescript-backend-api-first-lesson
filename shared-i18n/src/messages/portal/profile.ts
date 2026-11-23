import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countedIn, listed, postalCodeOf } from './written'

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
    lastName: text({ en: 'Last name', ja: '姓' }),
    firstName: text({ en: 'First name', ja: '名' }),
    lastNameKana: text({ en: 'Phonetic last name', ja: '姓（フリガナ）' }),
    firstNameKana: text({ en: 'Phonetic first name', ja: '名（フリガナ）' }),
    phoneNumber: text({ en: 'Phone number', ja: '電話番号' }),
    phoneNumberDescription: text({
      en: 'The salon may contact you about your booking.',
      ja: 'ご予約について、サロンから連絡することがあります。',
    }),
    alternativePhone: text({
      en: 'Alternative phone number',
      ja: '予備の電話番号',
    }),
    alternativePhoneDescription: text({
      en: 'The number the salon calls when the one above does not answer.',
      ja: '上の番号につながらないときに、連絡する番号です。',
    }),
    postalCode: text({ en: 'Postal code', ja: '郵便番号' }),
    prefecture: text({ en: 'Prefecture', ja: '都道府県' }),
    city: text({ en: 'City', ja: '市区町村' }),
    address: text({ en: 'Street address', ja: '番地' }),
    building: text({ en: 'Building and room', ja: '建物名・部屋番号' }),
    birthDate: text({ en: 'Date of birth', ja: '生年月日' }),
    gender: text({ en: 'Gender', ja: '性別' }),
    /** The first choice of the gender, which says none */
    noGender: text({ en: 'Not specified', ja: '選択しない' }),
    occupation: text({ en: 'Occupation', ja: '職業' }),
    preferredServices: text({ en: 'Favorite services', ja: '好みのメニュー' }),
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
    name: text({ en: 'Name', ja: 'お名前' }),
    contact: text({ en: 'Contact', ja: '連絡先' }),
    address: text({ en: 'Address', ja: '住所' }),
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
    kana: text({ en: 'Phonetic name', ja: 'フリガナ' }),
    email: text({ en: 'Email address', ja: 'メールアドレス' }),
    /** The postal code of the address: 「〒150-0001」 */
    postalCode: postalCodeOf,
    /** The entries of a list (the favorite services, the messages received): 「カット、カラー」 */
    listed: (entries: readonly LocalizedText[]) => listed(entries),
    byEmail: text({ en: 'Messages by email', ja: 'メールでの連絡' }),
    bySms: text({ en: 'Messages by SMS', ja: 'SMS での連絡' }),
    marketing: text({
      en: 'News such as campaigns',
      ja: 'キャンペーンなどのお知らせ',
    }),
  },
  /** What the salons keep of a member, which the customer cannot change */
  membership: {
    title: text({ en: 'Membership', ja: '会員の情報' }),
    tier: text({ en: 'Membership rank', ja: '会員ランク' }),
    points: text({ en: 'Points', ja: 'ポイント' }),
    /** A number of points: 「2,500 ポイント」 */
    pointsOf: (points: number) =>
      text({
        en: countedIn(points, 'point', 'points'),
        ja: `${numberOf(points).ja} ポイント`,
      }),
    visits: text({ en: 'Visits', ja: '来店回数' }),
    /** How often a customer came: 「12 回」 */
    visitsOf: (count: number) =>
      text({
        en: countedIn(count, 'visit', 'visits'),
        ja: `${numberOf(count).ja} 回`,
      }),
    firstVisit: text({ en: 'First visit', ja: '初めての来店' }),
    lastVisit: text({ en: 'Last visit', ja: '最後の来店' }),
    /** What stands where a day would, for a customer who has not come yet */
    noVisit: text({ en: 'No visits yet', ja: 'まだ来店がありません' }),
    referralCode: text({ en: 'Referral code', ja: '紹介コード' }),
    notIssued: text({ en: 'Not issued', ja: '未発行' }),
    hairType: text({ en: 'Hair type', ja: '髪質' }),
    hairThickness: text({ en: 'Hair thickness', ja: '髪の太さ' }),
    scalpCondition: text({ en: 'Scalp condition', ja: '頭皮の状態' }),
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
