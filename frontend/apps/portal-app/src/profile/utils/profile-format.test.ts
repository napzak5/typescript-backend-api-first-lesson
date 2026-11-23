import type {
  ModelsHairThicknessType,
  ModelsHairType,
  ModelsScalpConditionType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { newProfile, profile } from '../components/examples'
import {
  addressLinesOf,
  categoryNamesOf,
  contactsOf,
  fullNameOf,
  hairOf,
  kanaOf,
  localDateOf,
} from './profile-format'

/** A word, as both languages write it */
type Said = { en: string; ja: string }

const HAIR_TYPE: Said = { en: 'Hair type', ja: '髪質' }
const HAIR_THICKNESS: Said = { en: 'Hair thickness', ja: '髪の太さ' }
const SCALP_CONDITION: Said = { en: 'Scalp condition', ja: '頭皮の状態' }
const BY_EMAIL: Said = { en: 'Messages by email', ja: 'メールでの連絡' }
const BY_SMS: Said = { en: 'Messages by SMS', ja: 'SMS での連絡' }
const MARKETING: Said = {
  en: 'News such as campaigns',
  ja: 'キャンペーンなどのお知らせ',
}

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
      { en: '150-0001', ja: '〒150-0001' },
      '東京都 渋谷区 神宮前 1-2-3',
      'こもれびハイツ 302',
    ])
  })

  it('should have no line when nothing of the address is there', () => {
    expect(addressLinesOf(newProfile)).toEqual([])
  })

  it.each([
    [
      'the postal code alone',
      { postalCode: '150-0001' },
      [{ en: '150-0001', ja: '〒150-0001' }],
    ],
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

describe('categoryNamesOf', () => {
  it('should name the kinds in the order the form offers them, whatever order they are kept in', () => {
    expect(categoryNamesOf(['spa', 'other', 'cut'])).toEqual([
      { en: 'Cut', ja: 'カット' },
      { en: 'Spa', ja: 'スパ' },
      { en: 'Other', ja: 'その他' },
    ])
  })

  it('should name a kind once that is kept twice', () => {
    expect(categoryNamesOf(['color', 'color'])).toEqual([
      { en: 'Color', ja: 'カラー' },
    ])
  })

  it('should name nothing for no kind', () => {
    expect(categoryNamesOf([])).toEqual([])
  })
})

describe('contactsOf', () => {
  it('should name every way the customer allows', () => {
    expect(
      contactsOf({ allowEmail: true, allowSms: true, allowMarketing: true }),
    ).toEqual([BY_EMAIL, BY_SMS, MARKETING])
  })

  it.each([
    [{ allowEmail: true, allowSms: false, allowMarketing: false }, BY_EMAIL],
    [{ allowEmail: false, allowSms: true, allowMarketing: false }, BY_SMS],
    [{ allowEmail: false, allowSms: false, allowMarketing: true }, MARKETING],
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
  it.each<[ModelsHairType, Said]>([
    ['straight', { en: 'Straight', ja: 'ストレート' }],
    ['wavy', { en: 'Wavy', ja: 'ウェーブ' }],
    ['curly', { en: 'Curly', ja: 'カール' }],
    ['coily', { en: 'Coily', ja: '強いカール' }],
  ])('should call the hair type %s %o', (hairType, name) => {
    expect(
      hairOf({ hairType, hairThickness: null, scalpCondition: null }).at(0),
    ).toEqual({ term: HAIR_TYPE, description: name })
  })

  it.each<[ModelsHairThicknessType, Said]>([
    ['thin', { en: 'Fine', ja: '細い' }],
    ['medium', { en: 'Medium', ja: 'ふつう' }],
    ['thick', { en: 'Thick', ja: '太い' }],
  ])('should call hair that is %s %o', (hairThickness, name) => {
    expect(
      hairOf({ hairType: null, hairThickness, scalpCondition: null }).at(1),
    ).toEqual({ term: HAIR_THICKNESS, description: name })
  })

  it.each<[ModelsScalpConditionType, Said]>([
    ['normal', { en: 'Normal', ja: 'ふつう' }],
    ['dry', { en: 'Dry', ja: '乾燥' }],
    ['oily', { en: 'Oily', ja: '脂性' }],
    ['sensitive', { en: 'Sensitive', ja: '敏感' }],
    ['dandruff', { en: 'Prone to dandruff', ja: 'フケが出やすい' }],
  ])('should call a scalp that is %s %o', (scalpCondition, name) => {
    expect(
      hairOf({ hairType: null, hairThickness: null, scalpCondition }).at(2),
    ).toEqual({ term: SCALP_CONDITION, description: name })
  })

  it('should say of each that it is missing when no salon wrote it down', () => {
    expect(hairOf(newProfile)).toEqual([
      { term: HAIR_TYPE, description: null },
      { term: HAIR_THICKNESS, description: null },
      { term: SCALP_CONDITION, description: null },
    ])
  })
})
