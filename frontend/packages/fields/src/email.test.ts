import { describe, expect, it } from 'vitest'
import { emailError } from './email'

const MALFORMED =
  'メールアドレスは、hanako@example.com のような形で入力してください。'

describe('emailError', () => {
  it.each<[string, string, string | undefined]>([
    ['an address', 'hanako@example.com', undefined],
    [
      'an address of the longest length',
      `${'a'.repeat(243)}@example.com`,
      undefined,
    ],
    ['nothing', '', 'メールアドレスを入力してください。'],
    [
      'an address one character too long',
      `${'a'.repeat(244)}@example.com`,
      '255 文字以内で入力してください。',
    ],
    ['an address without its domain', 'hanako@', MALFORMED],
    ['a text without the at sign', 'hanako.example.com', MALFORMED],
    ['an address with a space in it', 'hanako @example.com', MALFORMED],
  ])('should tell what is wrong with %s', (_case, email, said) => {
    expect(emailError(email)).toBe(said)
  })
})
