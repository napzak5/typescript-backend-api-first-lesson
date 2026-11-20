import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { salon } from '../bookings/components/examples'
import {
  afterSalonChange,
  coordinateTextOf,
  readSalonChange,
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
      request: {
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
      request: {
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

  it.each<[string, string, string, string]>([
    ['name', '', 'name', 'サロンの名前を、255 文字までで入力してください。'],
    [
      'name',
      'あ'.repeat(256),
      'name',
      'サロンの名前を、255 文字までで入力してください。',
    ],
    [
      'nameKana',
      'ア'.repeat(256),
      'nameKana',
      'カナは、255 文字までで入力してください。',
    ],
    [
      'postalCode',
      '150-0001-01',
      'postalCode',
      '郵便番号は、10 文字までで入力してください。',
    ],
    [
      'prefecture',
      ' ',
      'prefecture',
      '都道府県を、50 文字までで入力してください。',
    ],
    [
      'prefecture',
      'あ'.repeat(51),
      'prefecture',
      '都道府県を、50 文字までで入力してください。',
    ],
    [
      'city',
      'あ'.repeat(101),
      'city',
      '市区町村を、100 文字までで入力してください。',
    ],
    [
      'address',
      '',
      'address',
      '町名・番地を、255 文字までで入力してください。',
    ],
    [
      'building',
      'あ'.repeat(256),
      'building',
      '建物は、255 文字までで入力してください。',
    ],
    [
      'latitude',
      '90.5',
      'latitude',
      '緯度は、-90 から 90 までの数（小数は 8 桁まで）で入力してください。',
    ],
    [
      'latitude',
      '35.123456789',
      'latitude',
      '緯度は、-90 から 90 までの数（小数は 8 桁まで）で入力してください。',
    ],
    [
      'longitude',
      '-180.1',
      'longitude',
      '経度は、-180 から 180 までの数（小数は 8 桁まで）で入力してください。',
    ],
    [
      'longitude',
      '東経 139',
      'longitude',
      '経度は、-180 から 180 までの数（小数は 8 桁まで）で入力してください。',
    ],
    [
      'phoneNumber',
      '03-1234',
      'phoneNumber',
      '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
    ],
    [
      'alternativePhone',
      '内線 12',
      'alternativePhone',
      '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
    ],
    [
      'email',
      'hikari',
      'email',
      'メールアドレスは、hanako@example.com のような形で入力してください。',
    ],
    [
      'websiteUrl',
      'hikari.example.com',
      'websiteUrl',
      'http:// または https:// で始まる URL を、500 文字以内で入力してください。',
    ],
    [
      'logoUrl',
      `https://example.com/${'a'.repeat(481)}`,
      'logoUrl',
      'http:// または https:// で始まる URL を、500 文字以内で入力してください。',
    ],
    [
      'imageUrls',
      'https://example.com/1.jpg\nexample.com/2.jpg',
      'imageUrls',
      '2 行目を確かめてください。http:// または https:// で始まる URL を書いてください。',
    ],
    [
      'taxRate',
      '',
      'taxRate',
      '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
    ],
    [
      'taxRate',
      '100.5',
      'taxRate',
      '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
    ],
    [
      'taxRate',
      '8.125',
      'taxRate',
      '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
    ],
    [
      'taxRate',
      '-1',
      'taxRate',
      '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
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
    ['logoUrl', `https://example.com/${'a'.repeat(480)}`],
    ['imageUrls', `https://example.com/${'a'.repeat(600)}`],
  ])('should take %s written as %j', (control, text) => {
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
    expect(afterSalonChange({ type: 'emailTaken' })).toEqual({
      message: undefined,
      errors: {
        email:
          'このメールアドレスは、ほかのサロンが使っています。ほかのメールアドレスを入力してください。',
      },
    })
  })

  it.each<[Parameters<typeof afterSalonChange>[0], string]>([
    [
      { type: 'invalid', values: [{ field: 'name', rule: 'too_big' }] },
      '入力した内容を確かめて、もう一度お試しください。',
    ],
    [
      { type: 'forbidden' },
      'このサロンの設定は、変えられません。設定を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'サロンの情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say what came of %j above the form', (outcome, message) => {
    expect(afterSalonChange(outcome)).toEqual({ message, errors: {} })
  })
})
