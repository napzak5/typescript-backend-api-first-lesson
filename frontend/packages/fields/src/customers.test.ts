import type { ModelsCustomerBasicPreferences } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  basicPreferencesIn,
  birthDateError,
  CUSTOMER_LENGTHS,
  customerControlOf,
  customerRefusalOf,
  GENDERS,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
  SERVICE_CATEGORIES,
  shownBasicPreferencesOf,
} from './customers'

const TODAY = '2026-11-22'

const OUT_OF_RANGE =
  '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。'

const REFUSED = 'この値は受け付けられませんでした。入力を確かめてください。'

/** A form sent with the given kinds of service and the given note; none where it is not given */
const formOf = (kinds: readonly string[], notes?: string): FormData => {
  const values = new FormData()
  for (const kind of kinds) {
    values.append(PREFERRED_SERVICES, kind)
  }
  if (notes !== undefined) {
    values.set(PREFERENCE_NOTES, notes)
  }

  return values
}

describe('the choices of a customer', () => {
  it('should hold the genders in the order of the contract', () => {
    expect(GENDERS).toEqual(['male', 'female', 'other', 'prefer_not_to_say'])
  })

  it('should hold the kinds of service in the order of the contract', () => {
    expect(SERVICE_CATEGORIES).toEqual([
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

describe('CUSTOMER_LENGTHS', () => {
  it('should hold the lengths the API takes for the texts that may be left empty', () => {
    expect(CUSTOMER_LENGTHS).toEqual({
      lastNameKana: 100,
      firstNameKana: 100,
      postalCode: 10,
      prefecture: 50,
      city: 100,
      address: 255,
      building: 255,
      occupation: 100,
    })
  })
})

describe('birthDateError', () => {
  it.each<[string, string | null, string | undefined]>([
    ['a day of birth left empty', null, undefined],
    ['today', TODAY, undefined],
    ['the first day the API takes', '1900-01-01', undefined],
    ['a day to come', '2026-11-23', OUT_OF_RANGE],
    ['a day before 1900', '1899-12-31', OUT_OF_RANGE],
    ['a day that does not exist', '2001-02-29', OUT_OF_RANGE],
    ['a text that is no day', '平成 13 年', OUT_OF_RANGE],
  ])('should tell what is wrong with %s', (_case, birthDate, said) => {
    expect(birthDateError(birthDate, TODAY)).toBe(said)
  })
})

describe('basicPreferencesIn', () => {
  it.each<[string, FormData, ModelsCustomerBasicPreferences | null]>([
    [
      'the kinds in the order of the contract, and the note without the spaces around it',
      formOf(['spa', 'cut'], '  香りの弱いものを  '),
      { preferredServices: ['cut', 'spa'], notes: '香りの弱いものを' },
    ],
    [
      'the kinds alone, with no note',
      formOf(['color'], '   '),
      { preferredServices: ['color'], notes: null },
    ],
    [
      'the note alone, with no kind',
      formOf([], '首が弱いです'),
      { preferredServices: [], notes: '首が弱いです' },
    ],
    [
      'nothing, when no kind is chosen and nothing is written',
      formOf([], ''),
      null,
    ],
    ['nothing, for a form without the controls', new FormData(), null],
    [
      'no kind that is none of those of the contract',
      formOf(['massage', 'perm']),
      { preferredServices: ['perm'], notes: null },
    ],
  ])('should read %s', (_case, values, preferences) => {
    expect(basicPreferencesIn(values)).toEqual(preferences)
  })
})

describe('shownBasicPreferencesOf', () => {
  it.each<
    [
      string,
      ModelsCustomerBasicPreferences | null,
      ModelsCustomerBasicPreferences | null,
    ]
  >([
    ['nothing for nothing', null, null],
    [
      'the kinds in the order of the contract, and the note without the spaces around it',
      { preferredServices: ['styling', 'color'], notes: ' 静かに ' },
      { preferredServices: ['color', 'styling'], notes: '静かに' },
    ],
    [
      'nothing for no kind and a note of spaces',
      { preferredServices: [], notes: '  ' },
      null,
    ],
  ])('should show %s', (_case, preferences, shown) => {
    expect(shownBasicPreferencesOf(preferences)).toEqual(shown)
  })

  it('should show what a form reads when it is sent as it was opened', () => {
    // Arrange
    const stored: ModelsCustomerBasicPreferences = {
      preferredServices: ['perm', 'cut'],
      notes: 'ボブにしたい',
    }

    // Act, Assert
    expect(basicPreferencesIn(formOf(['perm', 'cut'], 'ボブにしたい'))).toEqual(
      shownBasicPreferencesOf(stored),
    )
  })
})

describe('customerControlOf', () => {
  it.each<[string, string, string]>([
    [
      'the kinds of service for what a customer likes',
      'preferences',
      PREFERRED_SERVICES,
    ],
    [
      'the kinds of service for one of them',
      `${PREFERRED_SERVICES}.2`,
      PREFERRED_SERVICES,
    ],
    ['the note as its own control', PREFERENCE_NOTES, PREFERENCE_NOTES],
    ['any other value as its own control', 'phoneNumber', 'phoneNumber'],
  ])('should give %s', (_case, field, control) => {
    expect(customerControlOf(field)).toBe(control)
  })
})

describe('customerRefusalOf', () => {
  it.each<[string, string, string | undefined]>([
    ['lastName', 'too_big', '100 文字以内で入力してください。'],
    ['lastName', 'too_small', '姓を入力してください。'],
    ['firstName', 'too_big', '100 文字以内で入力してください。'],
    ['firstName', 'too_small', '名を入力してください。'],
    [
      'phoneNumber',
      'invalid_format',
      '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
    ],
    [
      'alternativePhone',
      'too_big',
      '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
    ],
    ['birthDate', 'custom', OUT_OF_RANGE],
    ['gender', 'invalid_value', '選択肢から選んでください。'],
    [PREFERRED_SERVICES, 'invalid_value', '選択肢から選んでください。'],
    [PREFERENCE_NOTES, 'too_big', REFUSED],
    ['postalCode', 'too_big', '10 文字以内で入力してください。'],
    ['building', 'too_big', '255 文字以内で入力してください。'],
    ['occupation', 'invalid_type', REFUSED],
    ['email', 'invalid_format', undefined],
    ['allowEmail', 'invalid_type', undefined],
  ])(
    'should say at %s, for the rule %s, what was wrong',
    (control, rule, said) => {
      expect(customerRefusalOf(control, rule)).toBe(said)
    },
  )
})
