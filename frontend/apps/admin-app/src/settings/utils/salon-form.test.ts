import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { salon } from '../../bookings/components/examples'
import {
  afterSalonChange,
  afterSalonEntry,
  CURRENCY_CHOICES,
  coordinateTextOf,
  NEW_SALON,
  readSalonChange,
  readSalonEntry,
  TIME_ZONE_CHOICES,
} from './salon-form'

/** A salon with something in every value the form shows */
const described: ModelsSalonResponse = {
  ...salon,
  nameKana: 'サロン ヒカリ',
  description: '表参道の駅から歩いて 3 分です。',
  building: '光ビル 2 階',
  latitude: 35.66,
  longitude: 139.71,
  alternativePhone: '090-1234-5678',
  websiteUrl: 'https://hikari.example.com',
  logoUrl: 'https://hikari.example.com/logo.png',
  imageUrls: [
    'https://hikari.example.com/1.jpg',
    'https://hikari.example.com/2.jpg',
  ],
  features: ['カット', 'カラー'],
  amenities: ['Wi-Fi'],
}

/** The form as it opens for a salon: every control holds what the salon has. */
const formOf = (
  shown: ModelsSalonResponse,
  changes: Record<string, string | null> = {},
): FormData => {
  const values = new FormData()
  const texts: Record<string, string> = {
    name: shown.name,
    nameKana: shown.nameKana ?? '',
    description: shown.description ?? '',
    postalCode: shown.postalCode ?? '',
    prefecture: shown.prefecture,
    city: shown.city,
    address: shown.address,
    building: shown.building ?? '',
    latitude: coordinateTextOf(shown.latitude),
    longitude: coordinateTextOf(shown.longitude),
    phoneNumber: shown.phoneNumber,
    alternativePhone: shown.alternativePhone ?? '',
    email: shown.email,
    websiteUrl: shown.websiteUrl ?? '',
    logoUrl: shown.logoUrl ?? '',
    imageUrls: shown.imageUrls.join('\n'),
    features: shown.features.join('、'),
    amenities: shown.amenities.join('、'),
    taxRate: String(shown.taxRate),
  }
  for (const [name, text] of Object.entries({ ...texts, ...changes })) {
    if (text !== null) {
      values.set(name, text)
    }
  }
  if (shown.isActive && changes['isActive'] !== null) {
    values.set('isActive', 'on')
  }

  return values
}

describe('readSalonChange', () => {
  it.each<[string, ModelsSalonResponse]>([
    ['a salon with little recorded', salon],
    ['a salon with everything recorded', described],
  ])('should send nothing for %s when nothing was changed', (_, shown) => {
    // Assert
    expect(readSalonChange(formOf(shown), shown)).toEqual({
      type: 'unchanged',
    })
  })

  it('should send what was changed and nothing else', () => {
    // Act
    const read = readSalonChange(
      formOf(described, {
        description: '  表参道の駅から歩いて 2 分です。 ',
        building: '',
        latitude: '-33.8688',
        longitude: '１５１．２０９３',
        alternativePhone: '',
        imageUrls:
          'https://hikari.example.com/2.jpg\n\nhttps://hikari.example.com/3.jpg\n',
        features: 'カット, パーマ、，',
        taxRate: '８',
        isActive: null,
      }),
      described,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        description: '表参道の駅から歩いて 2 分です。',
        building: null,
        latitude: -33.8688,
        longitude: 151.2093,
        alternativePhone: null,
        imageUrls: [
          'https://hikari.example.com/2.jpg',
          'https://hikari.example.com/3.jpg',
        ],
        features: ['カット', 'パーマ'],
        taxRate: 8,
        isActive: false,
      },
    })
  })

  it('should send the values that were written where there were none', () => {
    // Act
    const read = readSalonChange(
      formOf(salon, {
        name: 'Salon Hikari 表参道',
        nameKana: 'サロンヒカリ',
        postalCode: '150-0002',
        prefecture: '東京',
        city: '港区',
        address: '北青山 3-6-1',
        phoneNumber: '03-9876-5432',
        email: 'hikari@example.com',
        websiteUrl: 'http://hikari.example.com',
        logoUrl: 'https://hikari.example.com/logo.svg',
        amenities: '駐車場、Wi-Fi',
        taxRate: '8.25',
      }),
      salon,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        name: 'Salon Hikari 表参道',
        nameKana: 'サロンヒカリ',
        postalCode: '150-0002',
        prefecture: '東京',
        city: '港区',
        address: '北青山 3-6-1',
        phoneNumber: '03-9876-5432',
        email: 'hikari@example.com',
        websiteUrl: 'http://hikari.example.com',
        logoUrl: 'https://hikari.example.com/logo.svg',
        amenities: ['駐車場', 'Wi-Fi'],
        taxRate: 8.25,
      },
    })
  })

  it.each<[string, string, string, LocalizedText]>([
    [
      'name',
      '',
      'name',
      {
        en: 'Salon name: enter 1 to 255 characters.',
        ja: 'サロンの名前を、255 文字以内で入力してください。',
      },
    ],
    [
      'name',
      'あ'.repeat(256),
      'name',
      {
        en: 'Salon name: enter 1 to 255 characters.',
        ja: 'サロンの名前を、255 文字以内で入力してください。',
      },
    ],
    [
      'nameKana',
      'ア'.repeat(256),
      'nameKana',
      {
        en: 'Name in kana: enter up to 255 characters.',
        ja: 'カナは、255 文字以内で入力してください。',
      },
    ],
    [
      'postalCode',
      '150-0001-01',
      'postalCode',
      {
        en: 'Postal code: enter up to 10 characters.',
        ja: '郵便番号は、10 文字以内で入力してください。',
      },
    ],
    [
      'prefecture',
      ' ',
      'prefecture',
      {
        en: 'Prefecture: enter 1 to 50 characters.',
        ja: '都道府県を、50 文字以内で入力してください。',
      },
    ],
    [
      'prefecture',
      'あ'.repeat(51),
      'prefecture',
      {
        en: 'Prefecture: enter 1 to 50 characters.',
        ja: '都道府県を、50 文字以内で入力してください。',
      },
    ],
    [
      'city',
      'あ'.repeat(101),
      'city',
      {
        en: 'City: enter 1 to 100 characters.',
        ja: '市区町村を、100 文字以内で入力してください。',
      },
    ],
    [
      'address',
      '',
      'address',
      {
        en: 'Street address: enter 1 to 255 characters.',
        ja: '町名・番地を、255 文字以内で入力してください。',
      },
    ],
    [
      'building',
      'あ'.repeat(256),
      'building',
      {
        en: 'Building: enter up to 255 characters.',
        ja: '建物は、255 文字以内で入力してください。',
      },
    ],
    [
      'latitude',
      '90.5',
      'latitude',
      {
        en: 'Enter the latitude as a number from -90 to 90, with up to 8 decimal places.',
        ja: '緯度は、-90 から 90 までの数（小数は 8 桁まで）で入力してください。',
      },
    ],
    [
      'latitude',
      '35.123456789',
      'latitude',
      {
        en: 'Enter the latitude as a number from -90 to 90, with up to 8 decimal places.',
        ja: '緯度は、-90 から 90 までの数（小数は 8 桁まで）で入力してください。',
      },
    ],
    [
      'longitude',
      '-180.1',
      'longitude',
      {
        en: 'Enter the longitude as a number from -180 to 180, with up to 8 decimal places.',
        ja: '経度は、-180 から 180 までの数（小数は 8 桁まで）で入力してください。',
      },
    ],
    [
      'longitude',
      '東経 139',
      'longitude',
      {
        en: 'Enter the longitude as a number from -180 to 180, with up to 8 decimal places.',
        ja: '経度は、-180 から 180 までの数（小数は 8 桁まで）で入力してください。',
      },
    ],
    [
      'phoneNumber',
      '03-1234',
      'phoneNumber',
      {
        en: 'Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
        ja: '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
      },
    ],
    [
      'alternativePhone',
      '内線 12',
      'alternativePhone',
      {
        en: 'Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
        ja: '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
      },
    ],
    [
      'email',
      'hikari',
      'email',
      {
        en: 'Enter an email address in a form such as hanako@example.com.',
        ja: 'メールアドレスは、hanako@example.com のような形で入力してください。',
      },
    ],
    [
      'websiteUrl',
      'hikari.example.com',
      'websiteUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'logoUrl',
      `https://example.com/${'a'.repeat(481)}`,
      'logoUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'imageUrls',
      'https://example.com/1.jpg\nexample.com/2.jpg',
      'imageUrls',
      {
        en: 'Check line 2. Enter a URL that begins with http:// or https:// and has a domain name (such as example.com).',
        ja: '2 行目を確かめてください。http:// か https:// で始まる、ドメイン名（example.com など）の URL を入力してください。',
      },
    ],
    [
      'taxRate',
      '',
      'taxRate',
      {
        en: 'Enter the tax rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
      },
    ],
    [
      'taxRate',
      '100.5',
      'taxRate',
      {
        en: 'Enter the tax rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
      },
    ],
    [
      'taxRate',
      '8.125',
      'taxRate',
      {
        en: 'Enter the tax rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
      },
    ],
    [
      'taxRate',
      '-1',
      'taxRate',
      {
        en: 'Enter the tax rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
      },
    ],
  ])('should refuse %s written as %j', (control, text, at, message) => {
    expect(readSalonChange(formOf(salon, { [control]: text }), salon)).toEqual({
      type: 'invalid',
      errors: { [at]: message },
    })
  })

  it.each<[string, string]>([
    ['latitude', '-90'],
    ['longitude', '180'],
    ['taxRate', '100'],
    ['taxRate', '0'],
    ['name', '𠮷'.repeat(255)],
    ['nameKana', '𠮷'.repeat(255)],
    ['postalCode', '𠮷'.repeat(10)],
    ['prefecture', '𠮷'.repeat(50)],
    ['city', '𠮷'.repeat(100)],
    ['address', '𠮷'.repeat(255)],
    ['building', '𠮷'.repeat(255)],
    ['logoUrl', `https://example.com/${'a'.repeat(480)}`],
    ['imageUrls', `https://example.com/${'a'.repeat(600)}`],
  ])('should take %s written as %j', (control, text) => {
    // Assert
    expect(
      readSalonChange(formOf(salon, { [control]: text }), salon).type,
    ).toBe('valid')
  })
})

describe('coordinateTextOf', () => {
  it.each<[number | null, string]>([
    [35.658, '35.658'],
    [-0.0000001, '-0.0000001'],
    [139, '139'],
    [-180, '-180'],
    [0, '0'],
    [null, ''],
  ])('should write %s as %j', (coordinate, text) => {
    // Assert
    expect(coordinateTextOf(coordinate)).toBe(text)
  })

  it('should give a place the form reads back as it was', () => {
    // Arrange
    const shown = { ...salon, latitude: 0.0000001, longitude: -0.00000005 }

    // Act
    const read = readSalonChange(formOf(shown), shown)

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })
})

describe('afterSalonChange', () => {
  it('should say an email address of another salon at the email address', () => {
    // Assert
    expect(afterSalonChange({ type: 'emailTaken' })).toEqual({
      message: undefined,
      errors: {
        email: {
          en: 'Another salon uses this email address. Enter another email address.',
          ja: 'このメールアドレスは、ほかのサロンが使っています。ほかのメールアドレスを入力してください。',
        },
      },
    })
  })

  it.each<[Parameters<typeof afterSalonChange>[0], LocalizedText]>([
    [
      { type: 'invalid', values: [{ field: 'name', rule: 'too_big' }] },
      {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
    ],
    [
      { type: 'forbidden' },
      {
        en: 'The settings of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its settings.',
        ja: 'このサロンの設定は、変えられません。設定を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      { type: 'failed' },
      {
        en: 'Could not save the salon information. Check your connection and try again.',
        ja: 'サロンの情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %j above the form', (outcome, message) => {
    expect(afterSalonChange(outcome)).toEqual({ message, errors: {} })
  })
})

/** The form of a salon to be added, filled in as a salon is, with the time zone and the currency of Japan */
const entryOf = (
  shown: ModelsSalonResponse,
  changes: Record<string, string | null> = {},
): FormData =>
  formOf(shown, { timezone: 'Asia/Tokyo', currency: 'JPY', ...changes })

describe('readSalonEntry', () => {
  it('should send every value under the name of its property, with the time zone and the currency chosen and no hours', () => {
    // Act
    const read = readSalonEntry(
      entryOf(described, { timezone: 'Europe/Paris', currency: 'EUR' }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        name: 'Salon Hikari 表参道店',
        nameKana: 'サロン ヒカリ',
        description: '表参道の駅から歩いて 3 分です。',
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        address: '神宮前 4-1-1',
        building: '光ビル 2 階',
        latitude: 35.66,
        longitude: 139.71,
        phoneNumber: '03-1234-5678',
        alternativePhone: '090-1234-5678',
        email: 'omotesando@example.com',
        websiteUrl: 'https://hikari.example.com',
        logoUrl: 'https://hikari.example.com/logo.png',
        imageUrls: [
          'https://hikari.example.com/1.jpg',
          'https://hikari.example.com/2.jpg',
        ],
        features: ['カット', 'カラー'],
        amenities: ['Wi-Fi'],
        taxRate: 10,
        isActive: true,
        timezone: 'Europe/Paris',
        currency: 'EUR',
        businessHours: null,
        openingHours: [],
      },
    })
  })

  it('should send what was left empty as nothing, and no bookings online when the box is not ticked', () => {
    // Act
    const read = readSalonEntry(entryOf(salon, { isActive: null }))

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        nameKana: null,
        building: null,
        latitude: null,
        websiteUrl: null,
        imageUrls: [],
        features: [],
        isActive: false,
      },
    })
  })

  it('should say every value that is wrong at once, the time zone and the currency with the others', () => {
    // Act
    const read = readSalonEntry(
      entryOf(salon, { name: '', email: '', timezone: '', currency: '' }),
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        name: {
          en: 'Salon name: enter 1 to 255 characters.',
          ja: 'サロンの名前を、255 文字以内で入力してください。',
        },
        email: {
          en: 'Enter an email address.',
          ja: 'メールアドレスを入力してください。',
        },
        timezone: {
          en: 'Choose a time zone.',
          ja: 'タイムゾーンを選んでください。',
        },
        currency: { en: 'Choose a currency.', ja: '通貨を選んでください。' },
      },
    })
  })

  it.each<[string, string | null, LocalizedText]>([
    [
      'timezone',
      'Mars/Olympus',
      { en: 'Choose a time zone.', ja: 'タイムゾーンを選んでください。' },
    ],
    [
      'timezone',
      'asia/tokyo',
      { en: 'Choose a time zone.', ja: 'タイムゾーンを選んでください。' },
    ],
    [
      'timezone',
      null,
      { en: 'Choose a time zone.', ja: 'タイムゾーンを選んでください。' },
    ],
    [
      'currency',
      'jpy',
      { en: 'Choose a currency.', ja: '通貨を選んでください。' },
    ],
    [
      'currency',
      'YEN',
      { en: 'Choose a currency.', ja: '通貨を選んでください。' },
    ],
    [
      'currency',
      null,
      { en: 'Choose a currency.', ja: '通貨を選んでください。' },
    ],
  ])('should refuse %s chosen as %j', (control, text, message) => {
    expect(readSalonEntry(entryOf(salon, { [control]: text }))).toEqual({
      type: 'invalid',
      errors: { [control]: message },
    })
  })
})

describe('the choices of a salon to be added', () => {
  it('should offer the time zones by their names, the one of Japan among them', () => {
    // Assert
    expect(TIME_ZONE_CHOICES).toContainEqual({
      value: 'Asia/Tokyo',
      label: 'Asia/Tokyo',
    })
    expect(TIME_ZONE_CHOICES.length).toBeGreaterThan(300)
  })

  it('should offer the currencies by their codes and names', () => {
    // Assert
    expect(CURRENCY_CHOICES).toContainEqual({
      value: 'JPY',
      label: { en: 'JPY (Japanese Yen)', ja: 'JPY（日本円）' },
    })
    expect(CURRENCY_CHOICES).toContainEqual({
      value: 'EUR',
      label: { en: 'EUR (Euro)', ja: 'EUR（ユーロ）' },
    })
  })

  it('should open with what the choices offer', () => {
    // Assert
    expect(TIME_ZONE_CHOICES.map(({ value }) => value)).toContain(
      NEW_SALON.timezone,
    )
    expect(CURRENCY_CHOICES.map(({ value }) => value)).toContain(
      NEW_SALON.currency,
    )
  })
})

describe('afterSalonEntry', () => {
  it('should say an email address of another salon at the email address', () => {
    // Assert
    expect(afterSalonEntry({ type: 'emailTaken' })).toEqual({
      message: undefined,
      errors: {
        email: {
          en: 'Another salon uses this email address. Enter another email address.',
          ja: 'このメールアドレスは、ほかのサロンが使っています。ほかのメールアドレスを入力してください。',
        },
      },
    })
  })

  it.each<[Parameters<typeof afterSalonEntry>[0], LocalizedText]>([
    [
      { type: 'invalid', values: [{ field: 'timezone', rule: 'custom' }] },
      {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
    ],
    [
      { type: 'forbidden' },
      {
        en: 'This account cannot register salons. Only administrators can register a salon.',
        ja: 'このアカウントでは、サロンを登録できません。サロンを登録できるのは、管理者です。',
      },
    ],
    [
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      { type: 'failed' },
      {
        en: 'Could not register the salon. Check your connection and try again.',
        ja: 'サロンを登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %j above the form', (outcome, message) => {
    expect(afterSalonEntry(outcome)).toEqual({ message, errors: {} })
  })
})
