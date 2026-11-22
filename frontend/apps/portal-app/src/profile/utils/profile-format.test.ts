import type {
  ModelsCustomerGenderType,
  ModelsHairThicknessType,
  ModelsHairType,
  ModelsMembershipTierType,
  ModelsScalpConditionType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { newProfile, profile } from '../components/examples'
import {
  addressLinesOf,
  CATEGORY_OPTIONS,
  calendarDayOf,
  categoryNamesOf,
  contactsOf,
  fullNameOf,
  GENDER_OPTIONS,
  genderNameOf,
  hairOf,
  kanaOf,
  localDateOf,
  pointsOf,
  tierNameOf,
  visitsOf,
} from './profile-format'

describe('tierNameOf', () => {
  it.each<[ModelsMembershipTierType, string]>([
    ['regular', 'レギュラー'],
    ['silver', 'シルバー'],
    ['gold', 'ゴールド'],
    ['platinum', 'プラチナ'],
    ['vip', 'VIP'],
  ])('should call the rank %s %s', (tier, name) => {
    expect(tierNameOf(tier)).toBe(name)
  })
})

describe('GENDER_OPTIONS', () => {
  it('should offer every gender of the contract, in its order', () => {
    expect(GENDER_OPTIONS).toEqual([
      { value: 'male', label: '男性' },
      { value: 'female', label: '女性' },
      { value: 'other', label: 'その他' },
      { value: 'prefer_not_to_say', label: '回答しない' },
    ])
  })
})

describe('CATEGORY_OPTIONS', () => {
  it('should offer every kind of service of the contract, in its order', () => {
    expect(CATEGORY_OPTIONS).toEqual([
      { value: 'cut', label: 'カット' },
      { value: 'color', label: 'カラー' },
      { value: 'perm', label: 'パーマ' },
      { value: 'treatment', label: 'トリートメント' },
      { value: 'spa', label: 'スパ' },
      { value: 'styling', label: 'スタイリング' },
      { value: 'extension', label: 'エクステンション' },
      { value: 'other', label: 'その他' },
    ])
  })
})

describe('calendarDayOf', () => {
  it.each([
    ['2026-11-09', '2026年11月9日'],
    ['1990-05-15', '1990年5月15日'],
    ['2024-02-29', '2024年2月29日'],
    ['1900-01-01', '1900年1月1日'],
    ['2026-12-31', '2026年12月31日'],
  ])('should write %s as %s', (date, written) => {
    expect(calendarDayOf(date)).toBe(written)
  })
})

describe('localDateOf', () => {
  it.each([
    [
      'the first moment of a day',
      new Date(2026, 10, 19, 0, 0, 0),
      '2026-11-19',
    ],
    [
      'the last minute of a day',
      new Date(2026, 10, 19, 23, 59, 59),
      '2026-11-19',
    ],
    [
      'a day and a month of one digit',
      new Date(2026, 0, 5, 12, 0, 0),
      '2026-01-05',
    ],
  ])(
    'should be the date where the browser is, at %s',
    (_case, moment, date) => {
      expect(localDateOf(moment)).toBe(date)
    },
  )
})

describe('pointsOf', () => {
  it.each([
    [0, '0 ポイント'],
    [2500, '2,500 ポイント'],
    [1234567, '1,234,567 ポイント'],
  ])('should write %i points as %s', (points, written) => {
    expect(pointsOf(points)).toBe(written)
  })
})

describe('visitsOf', () => {
  it.each([
    [0, '0 回'],
    [12, '12 回'],
    [1024, '1,024 回'],
  ])('should write %i visits as %s', (count, written) => {
    expect(visitsOf(count)).toBe(written)
  })
})

describe('fullNameOf', () => {
  it('should put the family name first', () => {
    expect(fullNameOf(profile)).toBe('山田 花子')
  })
})

describe('kanaOf', () => {
  it('should put the family name first', () => {
    expect(kanaOf(profile)).toBe('ヤマダ ハナコ')
  })

  it.each([
    [{ lastNameKana: 'ヤマダ', firstNameKana: null }, 'ヤマダ'],
    [{ lastNameKana: null, firstNameKana: 'ハナコ' }, 'ハナコ'],
  ])('should be the part there is when the other is missing', (kana, read) => {
    expect(kanaOf(kana)).toBe(read)
  })

  it('should be nothing when neither part is there', () => {
    expect(kanaOf(newProfile)).toBeNull()
  })
})

describe('addressLinesOf', () => {
  it('should be the postal code, the address as it was written, and the building: a line each', () => {
    expect(addressLinesOf(profile)).toEqual([
      '〒150-0001',
      '東京都 渋谷区 神宮前 1-2-3',
      'こもれびハイツ 302',
    ])
  })

  it('should have no line when nothing of the address is there', () => {
    expect(addressLinesOf(newProfile)).toEqual([])
  })

  it.each([
    ['the postal code alone', { postalCode: '150-0001' }, ['〒150-0001']],
    ['the prefecture alone', { prefecture: '東京都' }, ['東京都']],
    [
      'the town without its prefecture',
      { city: '渋谷区', address: '神宮前 1-2-3' },
      ['渋谷区 神宮前 1-2-3'],
    ],
    [
      'the building alone',
      { building: 'こもれびハイツ 302' },
      ['こもれびハイツ 302'],
    ],
  ])('should have a line for what there is: %s', (_case, parts, lines) => {
    expect(addressLinesOf({ ...newProfile, ...parts })).toEqual(lines)
  })
})

describe('genderNameOf', () => {
  it.each<[ModelsCustomerGenderType, string]>([
    ['male', '男性'],
    ['female', '女性'],
    ['other', 'その他'],
    ['prefer_not_to_say', '回答しない'],
  ])('should call %s %s', (gender, name) => {
    expect(genderNameOf(gender)).toBe(name)
  })
})

describe('categoryNamesOf', () => {
  it('should name the kinds in the order the form offers them, whatever order they are kept in', () => {
    expect(categoryNamesOf(['spa', 'other', 'cut'])).toEqual([
      'カット',
      'スパ',
      'その他',
    ])
  })

  it('should name a kind once that is kept twice', () => {
    expect(categoryNamesOf(['color', 'color'])).toEqual(['カラー'])
  })

  it('should name nothing for no kind', () => {
    expect(categoryNamesOf([])).toEqual([])
  })
})

describe('contactsOf', () => {
  it('should name every way the customer allows', () => {
    expect(
      contactsOf({ allowEmail: true, allowSms: true, allowMarketing: true }),
    ).toEqual(['メールでの連絡', 'SMS での連絡', 'キャンペーンなどのお知らせ'])
  })

  it.each([
    [
      { allowEmail: true, allowSms: false, allowMarketing: false },
      'メールでの連絡',
    ],
    [
      { allowEmail: false, allowSms: true, allowMarketing: false },
      'SMS での連絡',
    ],
    [
      { allowEmail: false, allowSms: false, allowMarketing: true },
      'キャンペーンなどのお知らせ',
    ],
  ])('should name the one way that is allowed', (allowed, name) => {
    expect(contactsOf(allowed)).toEqual([name])
  })

  it('should name none when nothing is allowed', () => {
    expect(
      contactsOf({ allowEmail: false, allowSms: false, allowMarketing: false }),
    ).toEqual([])
  })
})

describe('hairOf', () => {
  it.each<[ModelsHairType, string]>([
    ['straight', 'ストレート'],
    ['wavy', 'ウェーブ'],
    ['curly', 'カール'],
    ['coily', '強いカール'],
  ])('should call the hair type %s %s', (hairType, name) => {
    expect(
      hairOf({ hairType, hairThickness: null, scalpCondition: null }).at(0),
    ).toEqual({ term: '髪質', description: name })
  })

  it.each<[ModelsHairThicknessType, string]>([
    ['thin', '細い'],
    ['medium', 'ふつう'],
    ['thick', '太い'],
  ])('should call hair that is %s %s', (hairThickness, name) => {
    expect(
      hairOf({ hairType: null, hairThickness, scalpCondition: null }).at(1),
    ).toEqual({ term: '髪の太さ', description: name })
  })

  it.each<[ModelsScalpConditionType, string]>([
    ['normal', 'ふつう'],
    ['dry', '乾燥'],
    ['oily', '脂性'],
    ['sensitive', '敏感'],
    ['dandruff', 'フケが出やすい'],
  ])('should call a scalp that is %s %s', (scalpCondition, name) => {
    expect(
      hairOf({ hairType: null, hairThickness: null, scalpCondition }).at(2),
    ).toEqual({ term: '頭皮の状態', description: name })
  })

  it('should say of each that it is missing when no salon wrote it down', () => {
    expect(hairOf(newProfile)).toEqual([
      { term: '髪質', description: null },
      { term: '髪の太さ', description: null },
      { term: '頭皮の状態', description: null },
    ])
  })
})
