import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { EMAIL_MALFORMED, emailError } from './email'

const MALFORMED = {
  en: 'Enter an email address in a form such as hanako@example.com.',
  ja: 'メールアドレスは、hanako@example.com のような形で入力してください。',
}

describe('emailError', () => {
  it.each<[string, string, LocalizedText | undefined]>([
    ['an address', 'hanako@example.com', undefined],
    [
      'an address of the longest length',
      `${'a'.repeat(243)}@example.com`,
      undefined,
    ],
    [
      'nothing',
      '',
      {
        en: 'Enter an email address.',
        ja: 'メールアドレスを入力してください。',
      },
    ],
    [
      'an address one character too long',
      `${'a'.repeat(244)}@example.com`,
      {
        en: 'Enter up to 255 characters.',
        ja: '255 文字以内で入力してください。',
      },
    ],
    [
      'an address of the longest length that holds a character outside the basic plane',
      `${'a'.repeat(242)}😀@example.com`,
      MALFORMED,
    ],
    ['an address without its domain', 'hanako@', MALFORMED],
    ['a text without the at sign', 'hanako.example.com', MALFORMED],
    ['an address with a space in it', 'hanako @example.com', MALFORMED],
  ])('should tell what is wrong with %s', (_case, email, said) => {
    expect(emailError(email)).toEqual(said)
  })
})

describe('EMAIL_MALFORMED', () => {
  it('should be the sentence of an address that is none', () => {
    expect(EMAIL_MALFORMED).toEqual(MALFORMED)
  })
})
