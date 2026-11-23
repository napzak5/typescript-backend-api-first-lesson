import { text } from '../../languages/localized-text'

/**
 * The names of what the record of a customer holds, which the ledger of a
 * salon and the profile of the customer say alike: the controls of their
 * forms, and the terms their records are shown with. What each says only
 * to its own reader (the parts of the profile that speak to the customer,
 * the treatment the salon gives a customer) is in its own catalogue.
 */
export const customerMessages = {
  /** The parts of the record that a form of either groups its controls into */
  parts: {
    name: text({ en: 'Name', ja: 'お名前' }),
    contact: text({ en: 'Contact', ja: '連絡先' }),
    address: text({ en: 'Address', ja: '住所' }),
  },
  lastName: text({ en: 'Last name', ja: '姓' }),
  firstName: text({ en: 'First name', ja: '名' }),
  lastNameKana: text({ en: 'Phonetic last name', ja: '姓（フリガナ）' }),
  firstNameKana: text({ en: 'Phonetic first name', ja: '名（フリガナ）' }),
  /** How the whole name is read */
  kana: text({ en: 'Phonetic name', ja: 'フリガナ' }),
  email: text({ en: 'Email address', ja: 'メールアドレス' }),
  phoneNumber: text({ en: 'Phone number', ja: '電話番号' }),
  alternativePhone: text({
    en: 'Alternative phone number',
    ja: '予備の電話番号',
  }),
  postalCode: text({ en: 'Postal code', ja: '郵便番号' }),
  prefecture: text({ en: 'Prefecture', ja: '都道府県' }),
  city: text({ en: 'City', ja: '市区町村' }),
  address: text({ en: 'Street address', ja: '番地' }),
  building: text({ en: 'Building and room', ja: '建物名・部屋番号' }),
  birthDate: text({ en: 'Date of birth', ja: '生年月日' }),
  gender: text({ en: 'Gender', ja: '性別' }),
  occupation: text({ en: 'Occupation', ja: '職業' }),
  preferredServices: text({ en: 'Favorite services', ja: '好みのメニュー' }),
  hairType: text({ en: 'Hair type', ja: '髪質' }),
  hairThickness: text({ en: 'Hair thickness', ja: '髪の太さ' }),
  scalpCondition: text({ en: 'Scalp condition', ja: '頭皮の状態' }),
  membershipTier: text({ en: 'Membership rank', ja: '会員ランク' }),
  referralCode: text({ en: 'Referral code', ja: '紹介コード' }),
  /** What stands for a referral code that is none yet */
  notIssued: text({ en: 'Not issued', ja: '未発行' }),
  visits: text({ en: 'Visits', ja: '来店回数' }),
  points: text({ en: 'Points', ja: 'ポイント' }),
  /** The ways a salon may reach a customer */
  byEmail: text({ en: 'Messages by email', ja: 'メールでの連絡' }),
  bySms: text({ en: 'Messages by SMS', ja: 'SMS での連絡' }),
  marketing: text({
    en: 'News such as campaigns',
    ja: 'キャンペーンなどのお知らせ',
  }),
}
