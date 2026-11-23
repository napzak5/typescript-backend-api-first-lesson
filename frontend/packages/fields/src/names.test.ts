import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { firstNameError, lastNameError } from './names'

const TOO_LONG = {
  en: 'Enter up to 100 characters.',
  ja: '100 文字以内で入力してください。',
}

describe('lastNameError and firstNameError', () => {
  it.each<
    [
      string,
      (name: string) => LocalizedText | undefined,
      string,
      LocalizedText | undefined,
    ]
  >([
    [
      'a last name that is missing',
      lastNameError,
      '',
      { en: 'Enter the last name.', ja: '姓を入力してください。' },
    ],
    [
      'a first name that is missing',
      firstNameError,
      '',
      { en: 'Enter the first name.', ja: '名を入力してください。' },
    ],
    ['a last name of one character', lastNameError, '林', undefined],
    [
      'a first name of the longest length',
      firstNameError,
      'あ'.repeat(100),
      undefined,
    ],
    [
      'a last name of the longest length, of characters outside the basic plane',
      lastNameError,
      '𠮷'.repeat(100),
      undefined,
    ],
    [
      'a last name one character too long',
      lastNameError,
      'あ'.repeat(101),
      TOO_LONG,
    ],
    [
      'a first name one character outside the basic plane too long',
      firstNameError,
      '𠮷'.repeat(101),
      TOO_LONG,
    ],
    [
      'a first name one character too long',
      firstNameError,
      'あ'.repeat(101),
      TOO_LONG,
    ],
  ])('should tell what is wrong with %s', (_case, error, name, said) => {
    expect(error(name)).toEqual(said)
  })
})
