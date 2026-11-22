import type { ModelsAllergySeverityType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  afterAllergyRemoval,
  afterAllergyWrite,
  allergyWrittenOf,
  mayRemoveAllergies,
  readAllergy,
  readAllergyChange,
  severityToneOf,
} from './allergies'
import type { AllergyRemoval } from './allergies-api'
import { anAllergy } from './components/examples'

const TODAY = '2026-11-20'

/** A form of an allergy as it is sent, with what it changes */
const valuesOf = (changes: Record<string, string> = {}): FormData => {
  const values = new FormData()
  Object.entries({
    allergenName: 'パラフェニレンジアミン（PPD）',
    allergyType: 'chemical',
    severityType: 'severe',
    symptoms: 'カラー剤で頭皮に赤みとかゆみが出た。',
    notes: 'ジアミンを含まないカラー剤を使う。\nパッチテストを先に。',
    confirmedDate: '2025-06-10',
    ...changes,
  }).forEach(([name, value]) => {
    values.set(name, value)
  })

  return values
}

describe('readAllergy', () => {
  it('should read every property, without the spaces around the texts', () => {
    // Act
    const read = readAllergy(
      valuesOf({ allergenName: '  ラテックス ', notes: ' 手袋を替える。 ' }),
      TODAY,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        allergyType: 'chemical',
        allergenName: 'ラテックス',
        severityType: 'severe',
        symptoms: 'カラー剤で頭皮に赤みとかゆみが出た。',
        notes: '手袋を替える。',
        confirmedDate: '2025-06-10',
      },
    })
  })

  it('should send what was left empty, or as spaces, as nothing', () => {
    // Act
    const read = readAllergy(
      valuesOf({ symptoms: '   ', notes: '', confirmedDate: '' }),
      TODAY,
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: { symptoms: null, notes: null, confirmedDate: null },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'no allergen',
      { allergenName: '  ' },
      { allergenName: 'アレルゲンを入力してください。' },
    ],
    [
      'an allergen longer than 255 characters',
      { allergenName: 'あ'.repeat(256) },
      { allergenName: 'アレルゲンは、255 文字以内で入力してください。' },
    ],
    ['no kind', { allergyType: '' }, { allergyType: '種類を選んでください。' }],
    [
      'a kind the contract does not name',
      { allergyType: 'dust' },
      { allergyType: '種類を選んでください。' },
    ],
    [
      'no severity',
      { severityType: '' },
      { severityType: '重篤度を選んでください。' },
    ],
    [
      'a day after today at the salon',
      { confirmedDate: '2026-11-21' },
      { confirmedDate: '確かめた日は、今日までにしてください。' },
    ],
    [
      'a day before 1900',
      { confirmedDate: '1899-12-31' },
      { confirmedDate: '確かめた日は、1900年1月1日以降にしてください。' },
    ],
    [
      'a day that is none',
      { confirmedDate: '2026-02-30' },
      { confirmedDate: '確かめた日を、日付で入力してください。' },
    ],
  ])('should refuse %s at its control', (_, changes, errors) => {
    // Act
    const read = readAllergy(valuesOf(changes), TODAY)

    // Assert
    expect(read).toEqual({ type: 'invalid', errors })
  })

  it('should take an allergen of 255 characters, counted as the API counts them, and today', () => {
    // Act
    const read = readAllergy(
      valuesOf({ allergenName: '𠮷'.repeat(255), confirmedDate: TODAY }),
      TODAY,
    )

    // Assert
    expect(read.type).toBe('valid')
  })

  it('should say everything that is wrong at once', () => {
    // Act
    const read = readAllergy(
      valuesOf({
        allergenName: '',
        allergyType: '',
        severityType: '',
        confirmedDate: '2027-01-01',
      }),
      TODAY,
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        allergyType: '種類を選んでください。',
        allergenName: 'アレルゲンを入力してください。',
        severityType: '重篤度を選んでください。',
        confirmedDate: '確かめた日は、今日までにしてください。',
      },
    })
  })
})

describe('readAllergyChange', () => {
  it('should ask for nothing when nothing was changed', () => {
    // Act
    const change = readAllergyChange(valuesOf(), anAllergy(), TODAY)

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should send only what was changed, and clear what was emptied', () => {
    // Act
    const change = readAllergyChange(
      valuesOf({ severityType: 'life_threatening', symptoms: '' }),
      anAllergy(),
      TODAY,
    )

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: { severityType: 'life_threatening', symptoms: null },
    })
  })

  it.each<[string, Record<string, string>, object]>([
    ['the kind', { allergyType: 'other' }, { allergyType: 'other' }],
    ['the allergen', { allergenName: 'PPD' }, { allergenName: 'PPD' }],
    ['the notes', { notes: '先に相談する。' }, { notes: '先に相談する。' }],
    [
      'the day it was confirmed on',
      { confirmedDate: '' },
      { confirmedDate: null },
    ],
  ])(
    'should send %s alone when it alone was changed',
    (_, changes, request) => {
      // Act
      const change = readAllergyChange(valuesOf(changes), anAllergy(), TODAY)

      // Assert
      expect(change).toEqual({ type: 'valid', value: request })
    },
  )

  it('should refuse a form with what is wrong, before it compares', () => {
    // Act
    const change = readAllergyChange(
      valuesOf({ allergenName: '' }),
      anAllergy(),
      TODAY,
    )

    // Assert
    expect(change).toEqual({
      type: 'invalid',
      errors: { allergenName: 'アレルゲンを入力してください。' },
    })
  })
})

describe('afterAllergyWrite', () => {
  it.each<[string, string, string]>([
    ['allergyType', 'invalid_value', '種類を選んでください。'],
    [
      'allergenName',
      'too_big',
      'アレルゲンは、255 文字以内で入力してください。',
    ],
    ['allergenName', 'custom', 'アレルゲンを入力してください。'],
    ['severityType', 'invalid_value', '重篤度を選んでください。'],
    ['confirmedDate', 'too_big', '確かめた日は、今日までにしてください。'],
    [
      'confirmedDate',
      'too_small',
      '確かめた日は、1900年1月1日以降にしてください。',
    ],
    [
      'confirmedDate',
      'invalid_format',
      '確かめた日を、日付で入力してください。',
    ],
  ])('should say at %s what the API refused with %s', (field, rule, said) => {
    // Act
    const says = afterAllergyWrite(
      { type: 'invalid', values: [{ field, rule }] },
      'entry',
    )

    // Assert
    expect(says).toEqual({ message: undefined, errors: { [field]: said } })
  })

  it('should say the first thing the API refused at a control, and ask to check what has no control', () => {
    // Act
    const says = afterAllergyWrite(
      {
        type: 'invalid',
        values: [
          { field: 'allergenName', rule: 'too_big' },
          { field: 'allergenName', rule: 'custom' },
          { field: 'customerId', rule: 'unrecognized_keys' },
        ],
      },
      'change',
    )

    // Assert
    expect(says).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {
        allergenName: 'アレルゲンは、255 文字以内で入力してください。',
      },
    })
  })

  it('should say at the allergen that the customer has one of it already', () => {
    // Act
    const says = afterAllergyWrite({ type: 'exists' }, 'entry')

    // Assert
    expect(says).toEqual({
      message: undefined,
      errors: {
        allergenName: 'このお客様には、同じアレルゲンの記録があります。',
      },
    })
  })

  it.each<
    [Parameters<typeof afterAllergyWrite>[0], 'entry' | 'change', string]
  >([
    [
      { type: 'forbidden' },
      'entry',
      'このアカウントでは、アレルギーを記録できません。',
    ],
    [
      { type: 'tooManyRequests' },
      'change',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'entry',
      'アレルギーを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'change',
      'アレルギーの記録を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say what came of %o in a %s', (outcome, write, message) => {
    // Act
    const says = afterAllergyWrite(outcome, write)

    // Assert
    expect(says).toEqual({ message, errors: {} })
  })
})

describe('allergyWrittenOf', () => {
  it.each<['entry' | 'change', string]>([
    ['entry', '山田 花子 様のアレルギー（PPD）を記録しました。'],
    ['change', '山田 花子 様のアレルギー（PPD）の記録を直しました。'],
  ])('should name the customer and the allergen after a %s', (write, said) => {
    // Act
    const message = allergyWrittenOf('山田 花子', 'PPD', write)

    // Assert
    expect(message).toBe(said)
  })
})

describe('afterAllergyRemoval', () => {
  it.each<[AllergyRemoval, object]>([
    [
      { type: 'removed' },
      {
        type: 'done',
        message: '山田 花子 様のアレルギー（PPD）の記録を削除しました。',
      },
    ],
    [
      { type: 'notFound' },
      {
        type: 'refused',
        message:
          'その間に、ほかのアカウントがこのアレルギーの記録を削除していました。',
      },
    ],
    [
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、アレルギーの記録を削除できません。間違えて記録したアレルギーの削除は、オーナーとマネージャーができます。',
      },
    ],
    [
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      { type: 'failed' },
      {
        type: 'again',
        message:
          'アレルギーの記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should take %o as %o', (outcome, says) => {
    // Act
    const said = afterAllergyRemoval(outcome, '山田 花子', 'PPD')

    // Assert
    expect(said).toEqual(says)
  })
})

describe('severityToneOf', () => {
  it('should set the two heaviest apart, each in a colour of its own', () => {
    // Arrange
    const severities: ModelsAllergySeverityType[] = [
      'life_threatening',
      'severe',
      'moderate',
      'mild',
    ]

    // Act
    const tones = severities.map(severityToneOf)

    // Assert
    expect(tones).toEqual(['danger', 'warning', 'neutral', 'neutral'])
  })
})

describe('mayRemoveAllergies', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should let %s remove an allergy: %s', (role, may) => {
    // Act
    const decided = mayRemoveAllergies(role)

    // Assert
    expect(decided).toBe(may)
  })
})
