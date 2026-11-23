import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { ServiceRemoval, ServiceWrite } from '../api/menu-api'
import {
  aDiscountedColour,
  aPackage,
  aService,
  colouring,
} from '../components/examples'
import {
  afterServiceRemoval,
  afterServiceWrite,
  inUseMessageOf,
  readServiceChange,
  readServiceEntry,
  refusesChoice,
} from './service-form'

/** The cut, as the form opens with it: a checkbox that is not checked is not handed over */
const SHOWN: Record<string, string | undefined> = {
  name: 'カット',
  categoryId: aService().categoryId ?? '',
  shortDescription: '似合わせのカット',
  description:
    'シャンプー、カット、ブローまで。\n仕上げのスタイリング剤はお選びいただけます。',
  tags: '人気',
  sortOrder: '1',
  duration: '60',
  pricingStrategy: 'fixed',
  price: '5500',
  discountPrice: '',
  taxIncluded: 'on',
  isActive: 'on',
  serviceStatus: 'active',
  availability: 'always',
  allowOnlineBooking: 'on',
  requiresConsultation: undefined,
  requiredStaffLevel: '',
  maxBookingsPerDay: '',
  imageUrl: 'https://photos.example.com/menu/cut.jpg',
  imageUrls: '',
  isPackage: undefined,
  'options.0.name': '前髪カット',
  'options.0.optionType': 'addon',
  'options.0.maxQuantity': '1',
  'options.0.additionalTime': '10',
  'options.0.additionalPrice': '1100',
  'options.0.description': '',
  'options.0.isRequired': undefined,
  'options.0.isActive': 'on',
}

/** The form as it opens with the cut, with some values changed, and more of them after */
const formWith = (
  changes: Record<string, string | undefined> = {},
  more: readonly [string, string][] = [],
): FormData =>
  formOfEntries([
    ...Object.entries({ ...SHOWN, ...changes }).flatMap(
      ([name, value]): [string, string][] =>
        value === undefined ? [] : [[name, value]],
    ),
    ...more,
  ])

/** The rows of a package that chose these services */
const packagedRows = (ids: readonly string[]): [string, string][] => [
  ['isPackage', 'on'],
  ...ids.map((id, index): [string, string] => [
    `packageServiceIds.${index}`,
    id,
  ]),
]

/** A web address of a length */
const addressOf = (length: number): string => {
  const start = 'https://photos.example.com/'

  return `${start}${'a'.repeat(length - start.length)}`
}

describe('readServiceEntry', () => {
  it('should read a whole service: texts without the spaces around them, the lists as they are written, the options in the order of their rows', () => {
    // Act
    const read = readServiceEntry(
      formWith(
        {
          name: '  ヘッドスパ  ',
          categoryId: '',
          shortDescription: '  ',
          tags: '人気、 季節限定 ,人気',
          sortOrder: '１２',
          duration: '45',
          price: '６０００',
          discountPrice: '5000',
          taxIncluded: undefined,
          pricingStrategy: 'variable',
          requiredStaffLevel: 'senior',
          maxBookingsPerDay: '3',
          imageUrls:
            ' https://photos.example.com/a.jpg \n\nhttps://photos.example.com/b.jpg\n',
          'options.0.description': ' 前髪だけ ',
          'options.0.isRequired': 'on',
        },
        [
          ['bookingRequirements', 'deposit_required'],
          ['bookingRequirements', 'patch_test_required'],
          ['options.1.name', '炭酸シャンプー'],
          ['options.1.optionType', 'upgrade'],
          ['options.1.maxQuantity', '2'],
          ['options.1.additionalTime', '0'],
          ['options.1.additionalPrice', '550'],
          ['options.1.description', ''],
        ],
      ),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        categoryId: null,
        name: 'ヘッドスパ',
        description:
          'シャンプー、カット、ブローまで。\n仕上げのスタイリング剤はお選びいただけます。',
        shortDescription: null,
        duration: 45,
        price: 6000,
        discountPrice: 5000,
        taxIncluded: false,
        pricingStrategy: 'variable',
        imageUrl: 'https://photos.example.com/menu/cut.jpg',
        imageUrls: [
          'https://photos.example.com/a.jpg',
          'https://photos.example.com/b.jpg',
        ],
        requiredStaffLevel: 'senior',
        maxBookingsPerDay: 3,
        requiresConsultation: false,
        allowOnlineBooking: true,
        bookingRequirements: ['patch_test_required', 'deposit_required'],
        isPackage: false,
        packageServiceIds: [],
        tags: ['人気', '季節限定'],
        sortOrder: 12,
        serviceStatus: 'active',
        availability: 'always',
        isActive: true,
        options: [
          {
            name: '前髪カット',
            description: '前髪だけ',
            optionType: 'addon',
            additionalTime: 10,
            additionalPrice: 1100,
            maxQuantity: 1,
            isRequired: true,
            sortOrder: 0,
            isActive: true,
          },
          {
            name: '炭酸シャンプー',
            description: null,
            optionType: 'upgrade',
            additionalTime: 0,
            additionalPrice: 550,
            maxQuantity: 2,
            isRequired: false,
            sortOrder: 1,
            isActive: false,
          },
        ],
      },
    })
  })

  it('should read a package with the services of its rows, in their order', () => {
    // Act
    const read = readServiceEntry(
      formWith({}, packagedRows([aDiscountedColour().id, aService().id])),
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        isPackage: true,
        packageServiceIds: [aDiscountedColour().id, aService().id],
      },
    })
  })

  it.each<[string, Record<string, string>, string, LocalizedText]>([
    [
      'a blank name',
      { name: '  ' },
      'name',
      {
        en: 'Service name: enter 1 to 255 characters.',
        ja: 'サービスの名前を、255 文字以内で入力してください。',
      },
    ],
    [
      'a name of 256 letters',
      { name: 'あ'.repeat(256) },
      'name',
      {
        en: 'Service name: enter 1 to 255 characters.',
        ja: 'サービスの名前を、255 文字以内で入力してください。',
      },
    ],
    [
      'a short description of 501 letters',
      { shortDescription: 'あ'.repeat(501) },
      'shortDescription',
      {
        en: 'Short description: enter up to 500 characters.',
        ja: '短い紹介は、500 文字以内で入力してください。',
      },
    ],
    [
      'no time',
      { duration: '' },
      'duration',
      {
        en: 'Enter the duration as a whole number of minutes from 1 to 1,440.',
        ja: '所要時間は、1 から 1,440 までの整数（分）で入力してください。',
      },
    ],
    [
      'a time of none',
      { duration: '0' },
      'duration',
      {
        en: 'Enter the duration as a whole number of minutes from 1 to 1,440.',
        ja: '所要時間は、1 から 1,440 までの整数（分）で入力してください。',
      },
    ],
    [
      'a time longer than a day',
      { duration: '1441' },
      'duration',
      {
        en: 'Enter the duration as a whole number of minutes from 1 to 1,440.',
        ja: '所要時間は、1 から 1,440 までの整数（分）で入力してください。',
      },
    ],
    [
      'a time in parts of a minute',
      { duration: '30.5' },
      'duration',
      {
        en: 'Enter the duration as a whole number of minutes from 1 to 1,440.',
        ja: '所要時間は、1 から 1,440 までの整数（分）で入力してください。',
      },
    ],
    [
      'no price',
      { price: '' },
      'price',
      {
        en: 'Enter the price as a whole number of 0 or more.',
        ja: '料金は、0 以上の整数で入力してください。',
      },
    ],
    [
      'a price below none',
      { price: '-1' },
      'price',
      {
        en: 'Enter the price as a whole number of 0 or more.',
        ja: '料金は、0 以上の整数で入力してください。',
      },
    ],
    [
      'a discount that is no number',
      { discountPrice: 'なし' },
      'discountPrice',
      {
        en: 'Enter the discounted price as a whole number of 0 or more. Leave it empty when there is no discount.',
        ja: '割引後の料金は、0 以上の整数で入力してください。割引がなければ、空のままにします。',
      },
    ],
    [
      'a discount above the price',
      { discountPrice: '5501' },
      'discountPrice',
      {
        en: 'The discounted price can be at most the price.',
        ja: '割引後の料金は、料金以下にしてください。',
      },
    ],
    [
      'a way of pricing the contract has not',
      { pricingStrategy: 'auction' },
      'pricingStrategy',
      {
        en: 'Choose how the price is decided.',
        ja: '価格の決め方を選んでください。',
      },
    ],
    [
      'no place in the order',
      { sortOrder: '' },
      'sortOrder',
      {
        en: 'Enter the display order as a whole number of 0 or more.',
        ja: '表示順は、0 以上の整数で入力してください。',
      },
    ],
    [
      'a state the contract has not',
      { serviceStatus: 'paused' },
      'serviceStatus',
      { en: 'Choose the offering status.', ja: '提供の状態を選んでください。' },
    ],
    [
      'days the contract has not',
      { availability: 'mondays' },
      'availability',
      { en: 'Choose the availability.', ja: '提供日を選んでください。' },
    ],
    [
      'a limit of none a day',
      { maxBookingsPerDay: '0' },
      'maxBookingsPerDay',
      {
        en: 'Enter the most bookings a day as a whole number of 1 or more. Leave it empty when there is no limit.',
        ja: '1 日の予約の上限は、1 以上の整数で入力してください。上限がなければ、空のままにします。',
      },
    ],
    [
      'a picture that is no web address',
      { imageUrl: 'photos.example.com/cut.jpg' },
      'imageUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'a picture of an address of 501 letters',
      { imageUrl: addressOf(501) },
      'imageUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'another picture that is no web address',
      { imageUrls: 'https://photos.example.com/a.jpg\nb.jpg' },
      'imageUrls',
      {
        en: 'Check line 2. Enter a URL that begins with http:// or https:// and has a domain name (such as example.com).',
        ja: '2 行目を確かめてください。http:// か https:// で始まる、ドメイン名（example.com など）の URL を入力してください。',
      },
    ],
    [
      'an option without a name',
      { 'options.0.name': ' ' },
      'options.0.name',
      {
        en: 'Option name: enter 1 to 255 characters.',
        ja: 'オプションの名前を、255 文字以内で入力してください。',
      },
    ],
    [
      'an option of a kind the contract has not',
      { 'options.0.optionType': 'gift' },
      'options.0.optionType',
      {
        en: 'Choose the type of the option.',
        ja: 'オプションの種類を選んでください。',
      },
    ],
    [
      'an option of a time below none',
      { 'options.0.additionalTime': '-5' },
      'options.0.additionalTime',
      {
        en: 'Enter the extra time as a whole number of minutes, 0 or more.',
        ja: '追加の時間は、0 以上の整数（分）で入力してください。',
      },
    ],
    [
      'an option without a price',
      { 'options.0.additionalPrice': '' },
      'options.0.additionalPrice',
      {
        en: 'Enter the extra price as a whole number of 0 or more.',
        ja: '追加の料金は、0 以上の整数で入力してください。',
      },
    ],
    [
      'an option chosen none at most',
      { 'options.0.maxQuantity': '0' },
      'options.0.maxQuantity',
      {
        en: 'Enter the most to choose as a whole number of 1 or more.',
        ja: '選べる数は、1 以上の整数で入力してください。',
      },
    ],
  ])('should refuse %s at its control', (_, changes, control, error) => {
    // Act
    const read = readServiceEntry(formWith(changes))

    // Assert
    expect(read).toEqual({ type: 'invalid', errors: { [control]: error } })
  })

  it('should take the longest names, counted as the API counts them, the longest time and the price of the discount alike', () => {
    // Act
    const read = readServiceEntry(
      formWith({
        name: '𠮷'.repeat(255),
        shortDescription: '𠮷'.repeat(500),
        'options.0.name': '𠮷'.repeat(255),
        duration: '1440',
        discountPrice: '5500',
        imageUrl: addressOf(500),
      }),
    )

    // Assert
    expect(read.type).toBe('valid')
  })

  it('should take a picture of the list at an address longer than the picture of the service may have: the API sets those no length', () => {
    // Act
    const read = readServiceEntry(
      formWith({
        imageUrls: `https://photos.example.com/a.jpg\n${addressOf(501)}`,
      }),
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        imageUrls: ['https://photos.example.com/a.jpg', addressOf(501)],
      },
    })
  })

  it.each<[string, readonly string[], Record<string, LocalizedText>]>([
    [
      'one service',
      [aService().id],
      {
        isPackage: {
          en: 'Choose 2 to 20 packaged services for a package.',
          ja: 'パッケージにするときは、構成サービスを 2 件から 20 件まで選んでください。',
        },
      },
    ],
    [
      'twenty-one services',
      Array.from(
        { length: 21 },
        (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      ),
      {
        isPackage: {
          en: 'Choose 2 to 20 packaged services for a package.',
          ja: 'パッケージにするときは、構成サービスを 2 件から 20 件まで選んでください。',
        },
      },
    ],
    [
      'a row that chose none',
      [aService().id, ''],
      {
        'packageServiceIds.1': {
          en: 'Choose a service.',
          ja: 'サービスを選んでください。',
        },
      },
    ],
    [
      'a service chosen twice',
      [aService().id, aDiscountedColour().id, aService().id],
      {
        'packageServiceIds.2': {
          en: 'A service can be put in only once.',
          ja: '同じサービスは、1 回だけ入れられます。',
        },
      },
    ],
  ])('should refuse a package of %s', (_, ids, errors) => {
    // Act
    const read = readServiceEntry(formWith({}, packagedRows(ids)))

    // Assert
    expect(read).toEqual({ type: 'invalid', errors })
  })

  it('should read no services of a package when the box that makes it is not checked', () => {
    // Act
    const read = readServiceEntry(
      formWith({}, [['packageServiceIds.0', aService().id]]),
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: { isPackage: false, packageServiceIds: [] },
    })
  })
})

describe('readServiceChange', () => {
  it('should ask for nothing when the form is sent as it was opened, the options renumbered by their rows', () => {
    // Act
    const read = readServiceChange(formWith(), aService())

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should send only what was changed, each compared as the form reads it', () => {
    // Act
    const read = readServiceChange(
      formWith({
        name: ' カット ',
        categoryId: colouring().id,
        price: '6000',
        discountPrice: '5800',
        tags: '人気、新しい',
        requiredStaffLevel: 'stylist',
      }),
      aService(),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        categoryId: colouring().id,
        price: 6000,
        discountPrice: 5800,
        requiredStaffLevel: 'stylist',
        tags: ['人気', '新しい'],
      },
    })
  })

  it('should send every option when one of them was changed', () => {
    // Act
    const read = readServiceChange(
      formWith({ 'options.0.additionalPrice': '1200' }, [
        ['options.1.name', '炭酸シャンプー'],
        ['options.1.optionType', 'addon'],
        ['options.1.maxQuantity', '1'],
        ['options.1.additionalTime', '0'],
        ['options.1.additionalPrice', '550'],
        ['options.1.description', ''],
        ['options.1.isActive', 'on'],
      ]),
      aService(),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        options: [
          expect.objectContaining({
            name: '前髪カット',
            additionalPrice: 1200,
            sortOrder: 0,
          }),
          expect.objectContaining({ name: '炭酸シャンプー', sortOrder: 1 }),
        ],
      },
    })
  })

  it('should send no options when all of them were taken away from a service without', () => {
    // Act
    const read = readServiceChange(
      formWith({
        'options.0.name': undefined,
        'options.0.optionType': undefined,
        'options.0.maxQuantity': undefined,
        'options.0.additionalTime': undefined,
        'options.0.additionalPrice': undefined,
        'options.0.description': undefined,
        'options.0.isActive': undefined,
      }),
      aService(),
    )

    // Assert
    expect(read).toEqual({ type: 'valid', value: { options: [] } })
  })

  it('should send the box and the empty list both when a package is undone', () => {
    // Act
    const read = readServiceChange(
      formWith({
        name: 'カットとカラー',
        categoryId: '',
        shortDescription: '',
        description: '',
        tags: '',
        sortOrder: '3',
        duration: '180',
        price: '12000',
        discountPrice: '11000',
        imageUrl: '',
        serviceStatus: 'coming_soon',
        isActive: undefined,
        'options.0.name': undefined,
        'options.0.optionType': undefined,
        'options.0.maxQuantity': undefined,
        'options.0.additionalTime': undefined,
        'options.0.additionalPrice': undefined,
        'options.0.description': undefined,
        'options.0.isActive': undefined,
      }),
      aPackage(),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: { isPackage: false, packageServiceIds: [] },
    })
  })

  it('should take what a booking requires as unchanged in whatever order it is stored', () => {
    // Act
    const read = readServiceChange(
      formWith({}, [
        ['bookingRequirements', 'patch_test_required'],
        ['bookingRequirements', 'deposit_required'],
      ]),
      aService({
        bookingRequirements: ['deposit_required', 'patch_test_required'],
      }),
    )

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should say what is wrong before anything is compared', () => {
    // Act
    const read = readServiceChange(formWith({ duration: '0' }), aService())

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        duration: {
          en: 'Enter the duration as a whole number of minutes from 1 to 1,440.',
          ja: '所要時間は、1 から 1,440 までの整数（分）で入力してください。',
        },
      },
    })
  })
})

describe('afterServiceWrite', () => {
  const refused = (
    field: string,
    rule: string,
  ): Extract<ServiceWrite, { type: 'invalid' }> => ({
    type: 'invalid',
    values: [{ field, rule }],
  })

  it.each<[string, string, string, LocalizedText]>([
    [
      'name',
      'too_big',
      'name',
      {
        en: 'Service name: enter 1 to 255 characters.',
        ja: 'サービスの名前を、255 文字以内で入力してください。',
      },
    ],
    [
      'discountPrice',
      'too_big',
      'discountPrice',
      {
        en: 'The discounted price can be at most the price.',
        ja: '割引後の料金は、料金以下にしてください。',
      },
    ],
    [
      'categoryId',
      'not_found',
      'categoryId',
      {
        en: 'This category was removed meanwhile. Choose the category again.',
        ja: 'このカテゴリーは、その間に削除されていました。カテゴリーを選び直してください。',
      },
    ],
    [
      'packageServiceIds',
      'not_found',
      'isPackage',
      {
        en: 'One of the packaged services was removed or made a package meanwhile. Choose again.',
        ja: '構成サービスのどれかが、その間に削除されたか、パッケージになっていました。選び直してください。',
      },
    ],
    [
      'packageServiceIds',
      'nested_package',
      'isPackage',
      {
        en: 'One of the packaged services was removed or made a package meanwhile. Choose again.',
        ja: '構成サービスのどれかが、その間に削除されたか、パッケージになっていました。選び直してください。',
      },
    ],
    [
      'packageServiceIds',
      'too_small',
      'isPackage',
      {
        en: 'Choose 2 to 20 packaged services for a package.',
        ja: 'パッケージにするときは、構成サービスを 2 件から 20 件まで選んでください。',
      },
    ],
    [
      'packageServiceIds',
      'too_big',
      'isPackage',
      {
        en: 'Choose 2 to 20 packaged services for a package.',
        ja: 'パッケージにするときは、構成サービスを 2 件から 20 件まで選んでください。',
      },
    ],
    [
      'packageServiceIds.1',
      'custom',
      'packageServiceIds.1',
      {
        en: 'A service can be put in only once.',
        ja: '同じサービスは、1 回だけ入れられます。',
      },
    ],
    [
      'isPackage',
      'contained_in_package',
      'isPackage',
      {
        en: 'A service that is in another package cannot be a package.',
        ja: '別のパッケージに入っているサービスは、パッケージにできません。',
      },
    ],
    [
      'options.2.maxQuantity',
      'too_small',
      'options.2.maxQuantity',
      {
        en: 'Enter the most to choose as a whole number of 1 or more.',
        ja: '選べる数は、1 以上の整数で入力してください。',
      },
    ],
    [
      'imageUrl',
      'invalid_format',
      'imageUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'imageUrls.1',
      'invalid_format',
      'imageUrls',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com).',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を入力してください。',
      },
    ],
  ])('should say a refused %s (%s) at %s', (field, rule, control, error) => {
    // Act
    const said = afterServiceWrite(refused(field, rule), 'change')

    // Assert
    expect(said).toEqual({ message: undefined, errors: { [control]: error } })
  })

  it('should ask to check the form again when the API refused a value it has no control of', () => {
    // Act
    const said = afterServiceWrite(
      refused('salonId', 'unrecognized_keys'),
      'entry',
    )

    // Assert
    expect(said).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it.each<[Parameters<typeof afterServiceWrite>, LocalizedText]>([
    [
      [{ type: 'forbidden' }, 'entry'],
      {
        en: 'The menu of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its menu.',
        ja: 'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      [{ type: 'tooManyRequests' }, 'change'],
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      [{ type: 'failed' }, 'entry'],
      {
        en: 'The service could not be added. Check your connection and try again.',
        ja: 'サービスを足せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
    [
      [{ type: 'failed' }, 'change'],
      {
        en: 'The service could not be saved. Check your connection and try again.',
        ja: 'サービスを直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what went wrong with an attempt: %j', (given, message) => {
    // Act
    const said = afterServiceWrite(...given)

    // Assert
    expect(said).toEqual({ message, errors: {} })
  })
})

describe('refusesChoice', () => {
  it.each<[string, boolean]>([
    ['categoryId', true],
    ['packageServiceIds', true],
    ['packageServiceIds.0', true],
    ['isPackage', true],
    ['name', false],
    ['options.0.name', false],
  ])('should read the lists again after %s was refused: %s', (field, again) => {
    expect(
      refusesChoice({ type: 'invalid', values: [{ field, rule: 'custom' }] }),
    ).toBe(again)
  })
})

describe('afterServiceRemoval', () => {
  it.each<[string, ServiceRemoval, ReturnType<typeof afterServiceRemoval>]>([
    [
      'a removal',
      { type: 'removed' },
      {
        type: 'done',
        message: {
          en: 'Removed the service “カット” from the menu.',
          ja: 'サービス「カット」を、メニューから削除しました。',
        },
      },
    ],
    ['a service in use', { type: 'inUse' }, { type: 'inUse' }],
    ['a service removed meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'a refusal',
      { type: 'forbidden' },
      {
        type: 'refused',
        message: {
          en: 'The menu of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its menu.',
          ja: 'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
        },
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message: {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message: {
          en: 'The service could not be removed. Check your connection and try again.',
          ja: 'サービスを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what came of %s', (_, outcome, says) => {
    expect(afterServiceRemoval(outcome, 'カット')).toEqual(says)
  })
})

describe('inUseMessageOf', () => {
  it('should name the packages a service is one of the services of', () => {
    expect(
      inUseMessageOf('カット', [aPackage(), { name: 'カットとパーマ' }]),
    ).toEqual({
      en: 'The service “カット” is in the packages “カットとカラー”, “カットとパーマ”, so it cannot be removed. Take it out of the packaged services first.',
      ja: 'サービス「カット」は、パッケージ「カットとカラー」「カットとパーマ」に入っているので、削除できません。先に、パッケージの構成サービスから外してください。',
    })
  })

  it('should name the bookings not over yet when no package has the service', () => {
    expect(inUseMessageOf('カット', [])).toEqual({
      en: 'The service “カット” is on the lines of bookings that are not finished, so it cannot be removed. Finish or cancel those bookings, or take the lines off them, then remove it.',
      ja: 'サービス「カット」は、終わっていない予約の施術明細にあるので、削除できません。その予約を終えるか、キャンセルするか、明細を外してから削除してください。',
    })
  })
})
