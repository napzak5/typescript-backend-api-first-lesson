import type {
  ModelsCustomerResponse,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { aCustomer } from '../../bookings/components/examples'
import {
  addressNameOf,
  categoriesNameOf,
  contactsNameOf,
  customerStatusNameOf,
  customerStatusToneOf,
  genderNameOf,
  HAIR_THICKNESS_CHOICES,
  HAIR_TYPE_CHOICES,
  hairNameOf,
  rateNameOf,
  SCALP_CONDITION_CHOICES,
  STATUS_CHOICES,
  staffNamesOf,
  TIER_CHOICES,
  tierNameOf,
} from './customer-format'

describe('the names of the values', () => {
  it('should name the ranks and offer them from the first to the highest', () => {
    // Act, Assert
    expect(tierNameOf('platinum')).toEqual({ en: 'Platinum', ja: 'プラチナ' })
    expect(TIER_CHOICES).toEqual([
      { value: 'regular', label: { en: 'Regular', ja: 'レギュラー' } },
      { value: 'silver', label: { en: 'Silver', ja: 'シルバー' } },
      { value: 'gold', label: { en: 'Gold', ja: 'ゴールド' } },
      { value: 'platinum', label: { en: 'Platinum', ja: 'プラチナ' } },
      { value: 'vip', label: { en: 'VIP', ja: 'VIP' } },
    ])
  })

  it('should name the states and make the one that keeps a customer from booking stand out', () => {
    // Act, Assert
    expect(STATUS_CHOICES).toEqual([
      { value: 'active', label: { en: 'Normal', ja: '通常' } },
      { value: 'inactive', label: { en: 'Dormant', ja: '休眠' } },
      { value: 'vip', label: { en: 'VIP', ja: 'VIP' } },
      { value: 'blacklisted', label: { en: 'Suspended', ja: '利用停止' } },
    ])
    expect(customerStatusNameOf('inactive')).toEqual({
      en: 'Dormant',
      ja: '休眠',
    })
    expect(customerStatusToneOf('blacklisted')).toBe('danger')
    expect(customerStatusToneOf('active')).toBe('success')
  })

  it('should offer the hair and the scalp in the order of the contract', () => {
    // Act, Assert
    expect(HAIR_TYPE_CHOICES.map(({ value }) => value)).toEqual([
      'straight',
      'wavy',
      'curly',
      'coily',
    ])
    expect(HAIR_THICKNESS_CHOICES).toEqual([
      { value: 'thin', label: { en: 'Fine', ja: '細い' } },
      { value: 'medium', label: { en: 'Medium', ja: 'ふつう' } },
      { value: 'thick', label: { en: 'Thick', ja: '太い' } },
    ])
    expect(SCALP_CONDITION_CHOICES.map(({ value }) => value)).toEqual([
      'normal',
      'dry',
      'oily',
      'sensitive',
      'dandruff',
    ])
  })
})

describe('genderNameOf', () => {
  it.each<[string, ModelsCustomerResponse['gender'], LocalizedText | null]>([
    ['a gender that was given', 'female', { en: 'Female', ja: '女性' }],
    [
      'an answer withheld',
      'prefer_not_to_say',
      { en: 'Prefer not to say', ja: '回答しない' },
    ],
    ['nothing given', null, null],
  ])('should name %s', (_case, gender, name) => {
    // Act, Assert
    expect(genderNameOf(gender)).toEqual(name)
  })
})

describe('categoriesNameOf', () => {
  it.each<[string, ModelsServiceCategoryType[], LocalizedText]>([
    [
      'kinds in the order of the contract',
      ['spa', 'cut'],
      { en: 'Cut, Spa', ja: 'カット、スパ' },
    ],
    ['no kind', [], { en: 'None', ja: 'なし' }],
  ])('should name %s', (_case, categories, name) => {
    // Act, Assert
    expect(categoriesNameOf(categories)).toEqual(name)
  })
})

describe('hairNameOf', () => {
  it.each<[string, Partial<ModelsCustomerResponse>, LocalizedText | null]>([
    [
      'all that was recorded',
      { hairType: 'wavy', hairThickness: 'thin', scalpCondition: 'dry' },
      {
        en: 'Type: Wavy; Thickness: Fine; Scalp: Dry',
        ja: 'ウェーブ、細い髪、頭皮は乾燥',
      },
    ],
    [
      'the scalp alone',
      { scalpCondition: 'sensitive' },
      { en: 'Scalp: Sensitive', ja: '頭皮は敏感' },
    ],
    ['nothing recorded', {}, null],
  ])('should name %s', (_case, hair, name) => {
    // Act, Assert
    expect(hairNameOf(aCustomer(hair))).toEqual(name)
  })
})

describe('addressNameOf', () => {
  it.each<[string, Partial<ModelsCustomerResponse>, LocalizedText | null]>([
    [
      'the whole address',
      {
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        address: '神宮前 4-1-1',
        building: 'ハイツ 101',
      },
      {
        en: '150-0001 東京都 渋谷区 神宮前 4-1-1 ハイツ 101',
        ja: '〒150-0001 東京都渋谷区神宮前 4-1-1 ハイツ 101',
      },
    ],
    ['the city alone', { city: '渋谷区' }, { en: '渋谷区', ja: '渋谷区' }],
    [
      'the postal code alone',
      { postalCode: '150-0001' },
      { en: '150-0001', ja: '〒150-0001' },
    ],
    ['no address', {}, null],
  ])('should write %s', (_case, address, name) => {
    // Act, Assert
    expect(addressNameOf(aCustomer(address))).toEqual(name)
  })
})

describe('contactsNameOf', () => {
  it.each<[string, Partial<ModelsCustomerResponse>, LocalizedText]>([
    [
      'every way',
      { allowEmail: true, allowSms: true, allowMarketing: true },
      {
        en: 'Email, SMS, News such as campaigns',
        ja: 'メール、SMS、キャンペーンなどのお知らせ',
      },
    ],
    [
      'the SMS alone',
      { allowEmail: false, allowSms: true, allowMarketing: false },
      { en: 'SMS', ja: 'SMS' },
    ],
    [
      'no way',
      { allowEmail: false, allowSms: false, allowMarketing: false },
      { en: 'None allowed', ja: '受け取らない' },
    ],
  ])('should name %s a customer may be reached by', (_case, ways, name) => {
    // Act, Assert
    expect(contactsNameOf(aCustomer(ways))).toEqual(name)
  })
})

describe('rateNameOf', () => {
  it.each<[number, string]>([
    [12.5, '12.5%'],
    [33.333, '33.3%'],
    [0, '0%'],
    [100, '100%'],
  ])('should write the share %d as %s in every language', (rate, name) => {
    // Act, Assert
    expect(rateNameOf(rate)).toEqual({ en: name, ja: name })
  })
})

describe('staffNamesOf', () => {
  const staff = new Map([
    ['4f1c8a52-7d3e-4b96-a0c5-2e9d6f8b1a37', { displayName: 'Mika Suzuki' }],
    ['b82e5d07-1a4c-4f69-9e3b-7c0d2a6f5e18', { displayName: 'Ken Sato' }],
  ])

  it('should name the members as the salons show them, in the order of the IDs', () => {
    // Act
    const names = staffNamesOf(
      [
        'b82e5d07-1a4c-4f69-9e3b-7c0d2a6f5e18',
        '4f1c8a52-7d3e-4b96-a0c5-2e9d6f8b1a37',
      ],
      staff,
    )

    // Assert
    expect(names).toEqual([
      { en: 'Ken Sato', ja: 'Ken Sato' },
      { en: 'Mika Suzuki', ja: 'Mika Suzuki' },
    ])
  })

  it('should say of a member no salon shows any more that there is one, in their place', () => {
    // Act
    const names = staffNamesOf(
      [
        '4f1c8a52-7d3e-4b96-a0c5-2e9d6f8b1a37',
        '0d9a3c61-5b2f-4e87-8a14-6f7e1c0b9d25',
      ],
      staff,
    )

    // Assert
    expect(names).toEqual([
      { en: 'Mika Suzuki', ja: 'Mika Suzuki' },
      { en: 'Staff member not listed', ja: '一覧にないスタッフ' },
    ])
  })

  it('should name nobody when no member is named', () => {
    expect(staffNamesOf([], staff)).toEqual([])
  })
})
