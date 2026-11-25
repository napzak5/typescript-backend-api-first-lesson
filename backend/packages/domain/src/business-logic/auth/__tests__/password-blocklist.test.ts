import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  authDependencies,
  dataOf,
  userRepositoryWith,
} from '../../../__tests__/fixtures/auth-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import { RegisterUseCase } from '..'
import { commonChoiceIssue } from '../_shared/password-blocklist'

/**
 * The passwords nobody may choose. The blocklist is part of the use cases
 * that set a password; it is exercised here through the registration, whose
 * account has the email below.
 */

const EMAIL = 'taro.yamada.salon@example.com'

/** The rules a registration with `password` breaks; empty when it is accepted. */
const rulesBrokenBy = async (password: string): Promise<string[]> => {
  const result = await new RegisterUseCase(
    authDependencies({
      userRepository: userRepositoryWith({
        findByEmail: async () => Result.success(null),
      }),
    }),
  ).execute({ email: EMAIL, password }, 'ja')

  return result.type === 'error' ? brokenRules(result.error) : []
}

describe('the passwords that are refused as too easy to guess', () => {
  it.each([
    // The account's email, or the part before the @.
    ['the email', 'taro.yamada.salon@example.com'],
    ['the email in capitals', 'TARO.YAMADA.SALON@EXAMPLE.COM'],
    ['the local part', 'taro.yamada.salon'],
    ['the local part as words', 'Taro Yamada Salon'],
    ['the local part in capitals with hyphens', 'TARO-YAMADA-SALON'],
    ['the local part without punctuation', 'taroyamadasalon'],
    ['the local part with punctuation around it', '"taro_yamada_salon!"'],
    // One unit of up to 8 characters, typed over and over.
    ['one character repeated', 'aaaaaaaaaaaaaaaa'],
    ['a unit of 6 repeated', 'abc123abc123abc123'],
    ['a unit with a space repeated', 'ha ha ha ha ha ha'],
    ['a unit of 8 repeated', 'pa55w0rdpa55w0rd'],
    ['a unit of 8 repeated, ending in the middle', 'abcd1234abcd1234ab'],
    // Neighbouring characters, up or down.
    ['letters up', 'abcdefghijklmnop'],
    ['digits up, over 9 to 0', '123456789012345'],
    ['digits down, over 0 to 9', '987654321098765'],
    ['letters down', 'zyxwvutsrqponmlk'],
    // Two code units each: neighbours by their code points.
    [
      'letters outside the Basic Multilingual Plane, up',
      '\u{1d41a}\u{1d41b}\u{1d41c}\u{1d41d}\u{1d41e}\u{1d41f}\u{1d420}\u{1d421}\u{1d422}\u{1d423}\u{1d424}\u{1d425}\u{1d426}\u{1d427}\u{1d428}',
    ],
    ['kana up', 'ぁあぃいぅうぇえぉおかがきぎく'],
    // Stretches of the keyboard rows.
    ['the first rows of the keyboard', 'qwertyuiopasdfgh'],
    ['the lower rows of the keyboard', 'asdfghjklzxcvbnm'],
    ['the digits and the top row', '1234567890qwerty'],
    ['the rows backwards', 'mnbvcxzlkjhgfdsa'],
    // Well-known long passwords, in any case, spacing and punctuation.
    ['a well-known passphrase', 'correct horse battery staple'],
    ['a well-known passphrase in title case', 'Correct Horse Battery Staple'],
    ['a well-known passphrase in one word', 'CorrectHorseBatteryStaple'],
    [
      'a well-known passphrase with punctuation',
      'correct-horse-battery-staple!',
    ],
    ['a pangram', 'the quick brown fox jumps over the lazy dog'],
    ['a pangram in capitals', 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.'],
    ['password and digits', 'password1234567890'],
    ['password and digits, spaced', 'Password 1234567890'],
    ['password and other digits, dressed up', 'Passw0rd-2026-11-18!'],
    ['qwerty and digits', 'qwerty1234567890'],
    ['a zigzag over two rows', '1q2w3e4r5t6y7u8i9o0p'],
    ['a zigzag over four rows', '1qaz2wsx3edc4rfv5tgb6yhn7ujm'],
  ])('refuses %s: %s', async (_case, password) => {
    expect(await rulesBrokenBy(password)).toEqual(['password:blocklisted'])
  })

  it.each([
    ['a passphrase', 'violet tram under the bridge'],
    ['15 lower-case letters that form no pattern', 'quietmorningtea'],
    [
      'a well-known passphrase with more words after it',
      'correct horse battery staple and more',
    ],
    [
      'a well-known passphrase with a word before it',
      'my correct horse battery staple',
    ],
    [
      'the local part of the email with other words',
      'taro.yamada.salon loves green tea',
    ],
    ['a unit of 9 characters repeated', 'violet123violet123'],
    ['the word password among other words', 'password of the salon'],
    ['a keyboard row with other words', 'qwertyuiop and then some'],
    ['a run of letters with other words', 'abcdefghijklmnop is the alphabet'],
    [
      'a repeated character with other words',
      'aaaaaaaaaaaaaaaa at the dentist',
    ],
  ])('accepts %s: %s', async (_case, password) => {
    expect(await rulesBrokenBy(password)).toEqual([])
  })

  it('tells the user which field is at fault and why, without echoing the password', async () => {
    const result = await new RegisterUseCase(
      authDependencies({
        userRepository: userRepositoryWith({
          findByEmail: async () => Result.success(null),
        }),
      }),
    ).execute({ email: EMAIL, password: 'Taro Yamada Salon' }, 'ja')

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        issues: [
          {
            field: 'password',
            rule: 'blocklisted',
            message: authMessages.passwordGuessableWithEmail,
          },
        ],
      },
    })
    expect(JSON.stringify(result)).not.toContain('Taro Yamada Salon')
  })

  it("accepts the local part of another account's email", async () => {
    const dependencies = authDependencies({
      userRepository: userRepositoryWith({
        findByEmail: async () => Result.success(null),
      }),
    })

    const result = await new RegisterUseCase(dependencies).execute(
      {
        email: 'hanako.suzuki@example.com',
        password: 'Taro Yamada Salon',
      },
      'ja',
    )

    expect(dataOf(result)).toBeNull()
  })
})

describe('commonChoiceIssue', () => {
  it('should refuse a password that anybody could guess under the field it is given, and say why', () => {
    // Arrange
    const password = 'correct horse battery staple'

    // Act
    const issue = commonChoiceIssue('password', password)

    // Assert
    expect(issue).toEqual({
      field: 'password',
      rule: 'blocklisted',
      message: authMessages.passwordGuessable,
    })
  })

  it('should find nothing wrong with a password that is no common choice', () => {
    // Arrange
    const password = 'violet tram under the bridge'

    // Act
    const issue = commonChoiceIssue('password', password)

    // Assert
    expect(issue).toBeNull()
  })
})
