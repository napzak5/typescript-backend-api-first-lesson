import { describe, expect, it } from 'vitest'
import type { SignInOutcome } from '../../sign-in'
import {
  afterAttempt,
  INITIAL_SIGN_IN_STATE,
  readAttempt,
  type SignInState,
} from './sign-in-flow'

const CREDENTIALS = {
  email: 'hanako@example.com',
  password: 'correct horse battery staple',
  rememberMe: false,
}

const AT_THE_CODE: SignInState = {
  step: { type: 'twoFactorCode', credentials: CREDENTIALS },
  message: undefined,
  errors: {},
}

const valuesOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

describe('readAttempt', () => {
  describe('at the first step', () => {
    it('should read the credentials, without a code', () => {
      // Act
      const read = readAttempt(
        { type: 'credentials' },
        valuesOf({ email: CREDENTIALS.email, password: CREDENTIALS.password }),
      )

      // Assert
      expect(read).toEqual({
        type: 'valid',
        value: { credentials: CREDENTIALS, twoFactorCode: null },
      })
    })

    it('should read a checked box as the wish to stay signed in', () => {
      // Act
      const read = readAttempt(
        { type: 'credentials' },
        valuesOf({ ...CREDENTIALS, rememberMe: 'on' }),
      )

      // Assert
      expect(read).toMatchObject({
        value: { credentials: { rememberMe: true } },
      })
    })

    it('should take the address without the spaces around it, and the password as it is', () => {
      // Act
      const read = readAttempt(
        { type: 'credentials' },
        valuesOf({ email: '  hanako@example.com ', password: ' a b ' }),
      )

      // Assert
      expect(read).toMatchObject({
        value: {
          credentials: { email: 'hanako@example.com', password: ' a b ' },
        },
      })
    })

    it.each([
      ['', 'メールアドレスを入力してください。'],
      ['   ', 'メールアドレスを入力してください。'],
      ['hanako', 'メールアドレスの形式で入力してください。'],
      ['hanako@', 'メールアドレスの形式で入力してください。'],
      ['hanako @example.com', 'メールアドレスの形式で入力してください。'],
    ])('should say of the address "%s": %s', (email, message) => {
      // Act
      const read = readAttempt(
        { type: 'credentials' },
        valuesOf({ email, password: CREDENTIALS.password }),
      )

      // Assert
      expect(read).toEqual({
        type: 'invalid',
        errors: { email: message, password: undefined },
      })
    })

    it('should say of every value that is missing that it is', () => {
      // Act
      const read = readAttempt({ type: 'credentials' }, new FormData())

      // Assert
      expect(read).toEqual({
        type: 'invalid',
        errors: {
          email: 'メールアドレスを入力してください。',
          password: 'パスワードを入力してください。',
        },
      })
    })

    it('should take a file for no value', () => {
      // Arrange
      const values = valuesOf({ password: CREDENTIALS.password })
      values.set('email', new File(['hanako@example.com'], 'email.txt'))

      // Act
      const read = readAttempt({ type: 'credentials' }, values)

      // Assert
      expect(read).toMatchObject({
        type: 'invalid',
        errors: { email: 'メールアドレスを入力してください。' },
      })
    })
  })

  describe('at the second step', () => {
    it('should read the code, with the credentials of the first step', () => {
      // Act
      const read = readAttempt(
        AT_THE_CODE.step,
        valuesOf({ twoFactorCode: ' 123456 ' }),
      )

      // Assert
      expect(read).toEqual({
        type: 'valid',
        value: { credentials: CREDENTIALS, twoFactorCode: '123456' },
      })
    })

    it('should say that the code is missing', () => {
      // Act
      const read = readAttempt(
        AT_THE_CODE.step,
        valuesOf({ twoFactorCode: ' ' }),
      )

      // Assert
      expect(read).toEqual({
        type: 'invalid',
        errors: { twoFactorCode: '認証コードを入力してください。' },
      })
    })
  })
})

describe('afterAttempt', () => {
  it('should leave the form as it is after signing in', () => {
    // Act
    const state = afterAttempt(INITIAL_SIGN_IN_STATE, CREDENTIALS, {
      type: 'signedIn',
    })

    // Assert
    expect(state).toBe(INITIAL_SIGN_IN_STATE)
  })

  it('should say that the credentials were refused, without saying which', () => {
    // Act
    const state = afterAttempt(INITIAL_SIGN_IN_STATE, CREDENTIALS, {
      type: 'wrongCredentials',
    })

    // Assert
    expect(state).toEqual({
      step: { type: 'credentials' },
      message:
        'メールアドレスまたはパスワードが正しくありません。続けて 5 回誤ると、15 分間サインインできなくなります。',
      errors: {},
    })
  })

  it('should go back to the first step when the credentials are refused at the second', () => {
    // Act
    const state = afterAttempt(AT_THE_CODE, CREDENTIALS, {
      type: 'wrongCredentials',
    })

    // Assert
    expect(state.step).toEqual({ type: 'credentials' })
    expect(state.message).toContain('正しくありません')
  })

  it('should ask for the code, and keep the credentials, when the account has two-factor authentication', () => {
    // Act
    const state = afterAttempt(INITIAL_SIGN_IN_STATE, CREDENTIALS, {
      type: 'twoFactorCodeRequired',
    })

    // Assert
    expect(state).toEqual({
      step: { type: 'twoFactorCode', credentials: CREDENTIALS },
      message: undefined,
      errors: {},
    })
  })

  it('should say that the code is wrong when it was asked for before', () => {
    // Act
    const state = afterAttempt(AT_THE_CODE, CREDENTIALS, {
      type: 'twoFactorCodeRequired',
    })

    // Assert
    expect(state).toEqual({
      ...AT_THE_CODE,
      errors: {
        twoFactorCode:
          'コードが正しくありません。新しいコードを入力してください。',
      },
    })
  })

  it('should say at the controls which values the API does not take', () => {
    // Act
    const state = afterAttempt(INITIAL_SIGN_IN_STATE, CREDENTIALS, {
      type: 'invalid',
      fields: ['email', 'password'],
    })

    // Assert
    expect(state).toEqual({
      step: { type: 'credentials' },
      message: undefined,
      errors: {
        email: 'メールアドレスの形式で入力してください。',
        password: 'パスワードを確かめて、入力し直してください。',
        twoFactorCode: undefined,
      },
    })
  })

  it('should stay at the second step when the API does not take the code', () => {
    // Act
    const state = afterAttempt(AT_THE_CODE, CREDENTIALS, {
      type: 'invalid',
      fields: ['twoFactorCode'],
    })

    // Assert
    expect(state.step).toEqual(AT_THE_CODE.step)
    expect(state.errors.twoFactorCode).toBe(
      '認証コードを確かめて、入力し直してください。',
    )
  })

  it('should go back to the first step when the API does not take a value of it at the second', () => {
    // Act
    const state = afterAttempt(AT_THE_CODE, CREDENTIALS, {
      type: 'invalid',
      fields: ['email'],
    })

    // Assert
    expect(state.step).toEqual({ type: 'credentials' })
    expect(state.errors.email).toBe('メールアドレスの形式で入力してください。')
  })

  it.each([[[]], [['rememberMe']]])(
    'should say that something is wrong when the API names no control of the form (%j)',
    (fields) => {
      // Act
      const state = afterAttempt(AT_THE_CODE, CREDENTIALS, {
        type: 'invalid',
        fields,
      })

      // Assert
      expect(state.step).toEqual({ type: 'credentials' })
      expect(state.message).toBe(
        '入力した内容を確かめて、もう一度お試しください。',
      )
    },
  )

  it.each<[SignInOutcome, string]>([
    [
      { type: 'tooManyAttempts' },
      '試した回数が多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'サインインできませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])(
    'should stay at the step and say what happened: %j',
    (outcome, message) => {
      // Act
      const state = afterAttempt(
        { ...AT_THE_CODE, errors: { twoFactorCode: '前の誤り' } },
        CREDENTIALS,
        outcome,
      )

      // Assert
      expect(state).toEqual({ ...AT_THE_CODE, message })
    },
  )

  it('should say that the browser has to store data to sign in', () => {
    // Act
    const state = afterAttempt(AT_THE_CODE, CREDENTIALS, { type: 'notStored' })

    // Assert
    expect(state.step).toEqual({ type: 'credentials' })
    expect(state.message).toContain('サイトのデータを保存しない設定')
  })
})
