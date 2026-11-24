import { text } from '../../languages/localized-text'

/*
 * The words that the parts of the settings catalogue share: the fields of
 * a salon, which the form, the record and the errors name alike, and the
 * buttons of the forms.
 */

/** The fields of a salon, and the parts they are in */
export const SALON_WORDS = {
  salon: text({ en: 'Salon', ja: 'サロン' }),
  name: text({ en: 'Name', ja: '名前' }),
  nameKana: text({ en: 'Name in kana', ja: 'カナ' }),
  description: text({ en: 'Introduction', ja: '紹介' }),
  location: text({ en: 'Location', ja: '所在地' }),
  postalCode: text({ en: 'Postal code', ja: '郵便番号' }),
  prefecture: text({ en: 'Prefecture', ja: '都道府県' }),
  city: text({ en: 'City', ja: '市区町村' }),
  address: text({ en: 'Street address', ja: '町名・番地' }),
  building: text({ en: 'Building', ja: '建物' }),
  latitude: text({ en: 'Latitude', ja: '緯度' }),
  longitude: text({ en: 'Longitude', ja: '経度' }),
  contact: text({ en: 'Contact', ja: '連絡先' }),
  phoneNumber: text({ en: 'Phone number', ja: '電話番号' }),
  alternativePhone: text({
    en: 'Alternative phone number',
    ja: '予備の電話番号',
  }),
  email: text({ en: 'Email address', ja: 'メールアドレス' }),
  websiteUrl: text({ en: 'Website', ja: '公式サイト' }),
  photos: text({ en: 'Photos', ja: '写真' }),
  logoUrl: text({ en: 'Logo URL', ja: 'ロゴの URL' }),
  imageUrls: text({ en: 'Photo URLs', ja: '写真の URL' }),
  featuresAndAmenities: text({
    en: 'Features and amenities',
    ja: '特徴と設備',
  }),
  features: text({ en: 'Features', ja: '特徴' }),
  amenities: text({ en: 'Amenities', ja: '設備' }),
  accounting: text({ en: 'Accounting', ja: '会計' }),
  timezone: text({ en: 'Time zone', ja: 'タイムゾーン' }),
  currency: text({ en: 'Currency', ja: '通貨' }),
  taxRate: text({ en: 'Tax rate', ja: '税率' }),
}

/** The button that sends the form of the hours */
export const SAVE = text({ en: 'Save', ja: '保存する' })

/** The link that leaves a form of the settings */
export const CANCEL = text({ en: 'Cancel', ja: 'やめる' })
