import type {
  ModelsCustomerResponse,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aCustomer } from '../bookings/components/examples'
import {
  addressNameOf,
  CATEGORY_OPTIONS,
  categoriesNameOf,
  contactsNameOf,
  countNameOf,
  customerStatusNameOf,
  customerStatusToneOf,
  genderNameOf,
  hairNameOf,
  rateNameOf,
  STATUS_OPTIONS,
  TIER_OPTIONS,
  tierNameOf,
} from './customer-format'

describe('the names of the values', () => {
  it('should name the ranks and offer them from the first to the highest', () => {
    // Act, Assert
    expect(tierNameOf('platinum')).toBe('プラチナ')
    expect(TIER_OPTIONS.map(({ label }) => label)).toEqual([
      'レギュラー',
      'シルバー',
      'ゴールド',
      'プラチナ',
      'VIP',
    ])
  })

  it('should name the states and make the one that keeps a customer from booking stand out', () => {
    // Act, Assert
    expect(STATUS_OPTIONS).toEqual([
      { value: 'active', label: '通常' },
      { value: 'inactive', label: '休眠' },
      { value: 'vip', label: 'VIP' },
      { value: 'blacklisted', label: '利用停止' },
    ])
    expect(customerStatusNameOf('inactive')).toBe('休眠')
    expect(customerStatusToneOf('blacklisted')).toBe('danger')
    expect(customerStatusToneOf('active')).toBe('success')
  })

  it('should offer the kinds of service in the order of the contract', () => {
    // Act, Assert
    expect(CATEGORY_OPTIONS.map(({ value }) => value)).toEqual([
      'cut',
      'color',
      'perm',
      'treatment',
      'spa',
      'styling',
      'extension',
      'other',
    ])
  })
})

describe('genderNameOf', () => {
  it.each<[string, ModelsCustomerResponse['gender'], string | null]>([
    ['a gender that was given', 'female', '女性'],
    ['an answer withheld', 'prefer_not_to_say', '回答しない'],
    ['nothing given', null, null],
  ])('should name %s', (_case, gender, name) => {
    // Act, Assert
    expect(genderNameOf(gender)).toBe(name)
  })
})

describe('categoriesNameOf', () => {
  it.each<[string, ModelsServiceCategoryType[], string]>([
    ['kinds in the order of the contract', ['spa', 'cut'], 'カット、スパ'],
    ['no kind', [], 'なし'],
  ])('should name %s', (_case, categories, name) => {
    // Act, Assert
    expect(categoriesNameOf(categories)).toBe(name)
  })
})

describe('hairNameOf', () => {
  it.each<[string, Partial<ModelsCustomerResponse>, string | null]>([
    [
      'all that was recorded',
      { hairType: 'wavy', hairThickness: 'thin', scalpCondition: 'dry' },
      'ウェーブ、細い髪、頭皮は乾燥',
    ],
    ['the scalp alone', { scalpCondition: 'sensitive' }, '頭皮は敏感'],
    ['nothing recorded', {}, null],
  ])('should name %s', (_case, hair, name) => {
    // Act, Assert
    expect(hairNameOf(aCustomer(hair))).toBe(name)
  })
})

describe('addressNameOf', () => {
  it.each<[string, Partial<ModelsCustomerResponse>, string | null]>([
    [
      'the whole address',
      {
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        address: '神宮前 4-1-1',
        building: 'ハイツ 101',
      },
      '〒150-0001 東京都渋谷区神宮前 4-1-1 ハイツ 101',
    ],
    ['the city alone', { city: '渋谷区' }, '渋谷区'],
    ['the postal code alone', { postalCode: '150-0001' }, '〒150-0001'],
    ['no address', {}, null],
  ])('should write %s', (_case, address, name) => {
    // Act, Assert
    expect(addressNameOf(aCustomer(address))).toBe(name)
  })
})

describe('contactsNameOf', () => {
  it.each<[string, Partial<ModelsCustomerResponse>, string]>([
    [
      'every way',
      { allowEmail: true, allowSms: true, allowMarketing: true },
      'メール、SMS、キャンペーンなどのお知らせ',
    ],
    [
      'the SMS alone',
      { allowEmail: false, allowSms: true, allowMarketing: false },
      'SMS',
    ],
    [
      'no way',
      { allowEmail: false, allowSms: false, allowMarketing: false },
      '受け取らない',
    ],
  ])('should name %s a customer may be reached by', (_case, ways, name) => {
    // Act, Assert
    expect(contactsNameOf(aCustomer(ways))).toBe(name)
  })
})

describe('rateNameOf and countNameOf', () => {
  it.each<[number, string]>([
    [12.5, '12.5%'],
    [0, '0%'],
    [100, '100%'],
  ])('should write the share %d as %s', (rate, name) => {
    // Act, Assert
    expect(rateNameOf(rate)).toBe(name)
  })

  it('should write a count with what it counts', () => {
    // Act, Assert
    expect(countNameOf(1200, '回')).toBe('1,200 回')
  })
})
