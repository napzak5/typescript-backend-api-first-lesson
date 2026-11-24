import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import {
  afterRefusal,
  messageAfter,
  readEmail,
  readNewPassword,
  readRegistration,
} from './account-flow'

const EMAIL_MISSING = {
  en: 'Enter an email address.',
  ja: 'メールアドレスを入力してください。',
}
const EMAIL_MALFORMED = {
  en: 'Enter an email address in a form such as hanako@example.com.',
  ja: 'メールアドレスは、hanako@example.com のような形で入力してください。',
}
const UP_TO_255 = {
  en: 'Enter up to 255 characters.',
  ja: '255 文字以内で入力してください。',
}
const PASSWORD_MISSING = {
  en: 'Enter a password.',
  ja: 'パスワードを入力してください。',
}
const TOO_SHORT = {
  en: 'The password is too short. Enter 15 characters or more.',
  ja: 'パスワードが短すぎます。15 文字以上で入力してください。',
}
const GUESSABLE = {
  en: 'This password is easy to guess and cannot be used. Enter another password.',
  ja: 'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
}
const REFUSED = {
  en: 'This password cannot be used. Enter another password.',
  ja: 'このパスワードは使えません。別のパスワードを入力してください。',
}
const CHECK_THE_VALUES = {
  en: 'Check what you entered and try again.',
  ja: '入力した内容を確かめて、もう一度お試しください。',
}
const NOT_SENT = {
  en: 'It could not be sent. Check your connection and try again.',
  ja: '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
}
const TOO_MANY_ATTEMPTS = {
  en: 'There were too many attempts. Wait a while and try again.',
  ja: '試した回数が多すぎます。しばらくしてから、もう一度お試しください。',
}

/**
 * One character that some keyboards type as two: a kana and its voicing
 * mark. The API counts a password as it stores it, with the two composed.
 */
const TYPED_AS_TWO = '\u304b\u3099'
const TOO_LONG = {
  en: 'The password is too long. Enter 128 characters or fewer.',
  ja: 'パスワードが長すぎます。128 文字以下で入力してください。',
}

describe('readEmail', () => {
  it('should take an address, without the spaces a pasted value comes with', () => {
    expect(readEmail(formOf({ email: '  hanako@example.com\n' }))).toEqual({
      type: 'valid',
      value: 'hanako@example.com',
    })
  })

  it.each([
    ['nothing', {}, EMAIL_MISSING],
    ['an empty value', { email: '' }, EMAIL_MISSING],
    ['spaces alone', { email: '   ' }, EMAIL_MISSING],
    ['a value that is no address', { email: 'hanako@' }, EMAIL_MALFORMED],
    [
      'an address longer than the API stores',
      { email: `${'a'.repeat(244)}@example.com` },
      UP_TO_255,
    ],
  ])('should say what to do about %s', (_case, values, error) => {
    expect(readEmail(formOf(values))).toEqual({
      type: 'invalid',
      errors: { email: error },
    })
  })

  it('should take an address as long as the API stores', () => {
    const email = `${'a'.repeat(243)}@example.com`

    expect(readEmail(formOf({ email }))).toEqual({
      type: 'valid',
      value: email,
    })
  })
})

describe('readNewPassword', () => {
  it('should take a password as it was typed, spaces and all', () => {
    expect(
      readNewPassword(formOf({ password: ' kirei na kami de ' }), 'password'),
    ).toEqual({ type: 'valid', value: ' kirei na kami de ' })
  })

  it.each([
    ['the shortest the API takes', 'a'.repeat(15)],
    ['the longest the API takes', 'a'.repeat(128)],
    ['fifteen emoji: a character is counted, not its units', '💇'.repeat(15)],
    [
      '128 characters that are typed as 256: the API counts them as it stores them',
      TYPED_AS_TWO.repeat(128),
    ],
  ])('should take %s', (_case, password) => {
    expect(readNewPassword(formOf({ password }), 'password')).toEqual({
      type: 'valid',
      value: password,
    })
  })

  it.each([
    ['nothing', '', PASSWORD_MISSING],
    ['fourteen characters', 'a'.repeat(14), TOO_SHORT],
    ['fourteen emoji, of 28 units', '💇'.repeat(14), TOO_SHORT],
    [
      'fourteen characters that are typed as 28',
      TYPED_AS_TWO.repeat(14),
      TOO_SHORT,
    ],
    ['129 characters', 'a'.repeat(129), TOO_LONG],
  ])('should say what to do about %s', (_case, password, error) => {
    expect(readNewPassword(formOf({ password }), 'password')).toEqual({
      type: 'invalid',
      errors: { password: error },
    })
  })

  it('should read the control it is asked for, and say the error under its name', () => {
    const values = formOf({ password: 'a'.repeat(20), newPassword: 'short' })

    expect(readNewPassword(values, 'newPassword')).toEqual({
      type: 'invalid',
      errors: { newPassword: TOO_SHORT },
    })
  })
})

describe('readRegistration', () => {
  it('should take an address and a password', () => {
    expect(
      readRegistration(
        formOf({ email: ' hanako@example.com ', password: 'a'.repeat(15) }),
      ),
    ).toEqual({
      type: 'valid',
      value: { email: 'hanako@example.com', password: 'a'.repeat(15) },
    })
  })

  it('should say everything that is wrong at once', () => {
    expect(
      readRegistration(formOf({ email: 'hanako', password: 'short' })),
    ).toEqual({
      type: 'invalid',
      errors: {
        email: EMAIL_MALFORMED,
        password: TOO_SHORT,
      },
    })
  })

  it.each([
    [
      'the address alone',
      { email: '', password: 'a'.repeat(15) },
      { email: EMAIL_MISSING },
    ],
    [
      'the password alone',
      { email: 'hanako@example.com', password: '' },
      { password: PASSWORD_MISSING },
    ],
  ])('should say what is wrong with %s', (_case, values, errors) => {
    expect(readRegistration(formOf(values))).toEqual({
      type: 'invalid',
      errors,
    })
  })
})

describe('afterRefusal', () => {
  it.each([
    ['password', 'too_small', TOO_SHORT],
    ['password', 'too_big', TOO_LONG],
    ['password', 'blocklisted', GUESSABLE],
    ['password', 'a rule this screen does not know', REFUSED],
    ['newPassword', 'too_small', TOO_SHORT],
    ['email', 'invalid_format', EMAIL_MALFORMED],
  ])(
    'should say at the control %s what the API means by %s',
    (field, rule, error) => {
      expect(
        afterRefusal({ type: 'invalid', values: [{ field, rule }] }),
      ).toEqual({ message: undefined, errors: { [field]: error } })
    },
  )

  it('should say the first thing the API says about a value, and something at every control it names', () => {
    expect(
      afterRefusal({
        type: 'invalid',
        values: [
          { field: 'password', rule: 'too_small' },
          { field: 'password', rule: 'blocklisted' },
          { field: 'email', rule: 'invalid_format' },
        ],
      }),
    ).toEqual({
      message: undefined,
      errors: {
        email: EMAIL_MALFORMED,
        password: TOO_SHORT,
      },
    })
  })

  it.each([
    ['names no value', []],
    [
      'names a value the form has no control for',
      [{ field: 'locale', rule: 'x' }],
    ],
  ])(
    'should say it about the whole attempt when the API %s',
    (_case, values) => {
      expect(afterRefusal({ type: 'invalid', values })).toEqual({
        message: CHECK_THE_VALUES,
        errors: {},
      })
    },
  )

  it('should say that there were too many attempts', () => {
    expect(afterRefusal({ type: 'tooManyAttempts' })).toEqual({
      message: TOO_MANY_ATTEMPTS,
      errors: {},
    })
  })

  it('should say that nothing was sent when the API gave no usable answer', () => {
    expect(afterRefusal({ type: 'failed' })).toEqual({
      message: NOT_SENT,
      errors: {},
    })
  })
})

describe('messageAfter', () => {
  it('should be what is said about the whole attempt', () => {
    expect(messageAfter({ type: 'failed' })).toEqual(NOT_SENT)
  })

  it('should be what would be said at a control, where there is none', () => {
    expect(
      messageAfter({
        type: 'invalid',
        values: [{ field: 'email', rule: 'invalid_format' }],
      }),
    ).toEqual(EMAIL_MALFORMED)
  })

  it('should be what is said of the first value the API named that something is said of', () => {
    expect(
      messageAfter({
        type: 'invalid',
        values: [
          { field: 'token', rule: 'invalid_format' },
          { field: 'password', rule: 'too_small' },
          { field: 'email', rule: 'invalid_format' },
        ],
      }),
    ).toEqual(TOO_SHORT)
  })

  it('should ask for the values to be checked when the API named none that something is said of', () => {
    expect(
      messageAfter({
        type: 'invalid',
        values: [{ field: 'token', rule: 'invalid_format' }],
      }),
    ).toEqual(CHECK_THE_VALUES)
  })

  it('should be the sentence of the sign-in when there were too many attempts', () => {
    expect(messageAfter({ type: 'tooManyAttempts' })).toEqual(TOO_MANY_ATTEMPTS)
  })
})
