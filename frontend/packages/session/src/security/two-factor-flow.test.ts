import type { Unsent } from '@beauty-salon-frontend/answers'
import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { account } from './components/examples'
import {
  afterRefusal,
  readCode,
  readPassword,
  readStop,
  secretGroupsOf,
  withTwoFactorStatus,
} from './two-factor-flow'

const PASSWORD = 'kirei na kami de dekakeru'
const LOCK = '5 回続けて違うと、15 分間、サインインもできなくなります。'
const PASSWORD_MISSING = 'パスワードを入力してください。'
const APP_CODE_MISSING =
  '認証アプリに表示されている 6 桁のコードを入力してください。'
const APP_CODE_MALFORMED =
  'コードは 6 桁の数字です。認証アプリに表示されている、いまのコードを入力してください。'
const CODE_MISSING =
  '認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。'
const CODE_TOO_LONG =
  'コードが長すぎます。認証アプリの 6 桁のコードか、バックアップコードを入力してください。'

const TOO_MANY_REQUESTS: Unsent = { type: 'tooManyRequests' }
const FAILED: Unsent = { type: 'failed' }

describe('readPassword', () => {
  it('should take the password as it was typed, spaces and all', () => {
    expect(readPassword(formOf({ password: ` ${PASSWORD} ` }))).toEqual({
      type: 'valid',
      value: ` ${PASSWORD} `,
    })
  })

  it('should take a password of any length: it was chosen under the rule of its day', () => {
    expect(readPassword(formOf({ password: 'a' }))).toEqual({
      type: 'valid',
      value: 'a',
    })
  })

  it.each([
    ['empty', formOf({ password: '' })],
    ['missing', formOf({})],
  ])('should ask for a password that is %s', (_case, form) => {
    expect(readPassword(form)).toEqual({
      type: 'invalid',
      errors: { password: PASSWORD_MISSING },
    })
  })

  it('should take a password of spaces alone: the API decides whether it is the password', () => {
    expect(readPassword(formOf({ password: '   ' }))).toEqual({
      type: 'valid',
      value: '   ',
    })
  })
})

describe('readCode', () => {
  describe('of the authenticator app alone', () => {
    it.each([
      ['as it is shown', '012345', '012345'],
      ['with the space the apps show in its middle', '012 345', '012345'],
      ['with spaces around it, pasted', ' 012345\n', '012345'],
      [
        'in digits of full width, as an input method types them',
        '０１２３４５',
        '012345',
      ],
    ])('should take a code %s, as six digits', (_case, typed, sent) => {
      expect(readCode(formOf({ code: typed }), 'app')).toEqual({
        type: 'valid',
        value: sent,
      })
    })

    it.each([
      ['empty', '', APP_CODE_MISSING],
      ['of spaces alone', '   ', APP_CODE_MISSING],
      ['of five digits', '01234', APP_CODE_MALFORMED],
      ['of seven digits', '0123456', APP_CODE_MALFORMED],
      ['with a letter', '01234a', APP_CODE_MALFORMED],
      ['that is a backup code', 'k7m2-pzqx-4hda-wn3e', APP_CODE_MALFORMED],
    ])('should not send a code that is %s', (_case, typed, error) => {
      expect(readCode(formOf({ code: typed }), 'app')).toEqual({
        type: 'invalid',
        errors: { code: error },
      })
    })

    it('should ask for a code that is missing', () => {
      expect(readCode(formOf({}), 'app')).toEqual({
        type: 'invalid',
        errors: { code: APP_CODE_MISSING },
      })
    })
  })

  describe('of the authenticator app, or a backup code', () => {
    it.each([
      ['of the app', '012 345', '012345'],
      [
        'that is a backup code, as it was issued',
        'K7M2-PZQX-4HDA-WN3E',
        'K7M2-PZQX-4HDA-WN3E',
      ],
      [
        'that is a backup code, in small letters',
        'k7m2-pzqx-4hda-wn3e',
        'k7m2-pzqx-4hda-wn3e',
      ],
      [
        'that is a backup code, with spaces around it',
        ' k7m2-pzqx-4hda-wn3e ',
        'k7m2-pzqx-4hda-wn3e',
      ],
      [
        'of 64 characters, the longest the API reads',
        'a'.repeat(64),
        'a'.repeat(64),
      ],
      [
        'of 64 characters outside the basic plane',
        '𠮷'.repeat(64),
        '𠮷'.repeat(64),
      ],
    ])('should take a code %s', (_case, typed, sent) => {
      expect(readCode(formOf({ code: typed }), 'appOrBackup')).toEqual({
        type: 'valid',
        value: sent,
      })
    })

    it.each([
      ['empty', '', CODE_MISSING],
      ['of spaces alone', ' \t ', CODE_MISSING],
      ['longer than the API reads', 'a'.repeat(65), CODE_TOO_LONG],
    ])('should not send a code that is %s', (_case, typed, error) => {
      expect(readCode(formOf({ code: typed }), 'appOrBackup')).toEqual({
        type: 'invalid',
        errors: { code: error },
      })
    })
  })
})

describe('readStop', () => {
  it('should take the password as it was typed, and the code without its spaces', () => {
    expect(
      readStop(
        formOf({ password: ` ${PASSWORD} `, code: ' k7m2-pzqx-4hda-wn3e ' }),
      ),
    ).toEqual({
      type: 'valid',
      value: { password: ` ${PASSWORD} `, code: 'k7m2-pzqx-4hda-wn3e' },
    })
  })

  it('should say what is wrong with both at once', () => {
    expect(readStop(formOf({ password: '', code: '' }))).toEqual({
      type: 'invalid',
      errors: { password: PASSWORD_MISSING, code: CODE_MISSING },
    })
  })

  it('should not send the request when one of them is wrong', () => {
    expect(readStop(formOf({ password: PASSWORD, code: '' }))).toEqual({
      type: 'invalid',
      errors: { password: undefined, code: CODE_MISSING },
    })
  })
})

describe('afterRefusal', () => {
  it('should say at the password that it is wrong, and that wrong attempts lock the account', () => {
    expect(
      afterRefusal(
        { type: 'invalid', values: [{ field: 'password', rule: 'incorrect' }] },
        'app',
      ),
    ).toEqual({
      message: undefined,
      errors: { password: `パスワードが違います。${LOCK}` },
    })
  })

  it('should say at a code of the app alone that it is wrong, and to type the code shown now', () => {
    expect(
      afterRefusal(
        { type: 'invalid', values: [{ field: 'code', rule: 'incorrect' }] },
        'app',
      ),
    ).toEqual({
      message: undefined,
      errors: {
        code: `コードが違います。認証アプリに表示されている、いまのコードを入力してください。${LOCK}`,
      },
    })
  })

  it('should say at a code that may be a backup code that it may have been used', () => {
    expect(
      afterRefusal(
        { type: 'invalid', values: [{ field: 'code', rule: 'incorrect' }] },
        'appOrBackup',
      ),
    ).toEqual({
      message: undefined,
      errors: {
        code: `コードが違うか、使ったことのあるバックアップコードです。${LOCK}`,
      },
    })
  })

  it('should say at both controls what the API named of both', () => {
    expect(
      afterRefusal(
        {
          type: 'invalid',
          values: [
            { field: 'password', rule: 'incorrect' },
            { field: 'code', rule: 'incorrect' },
          ],
        },
        'appOrBackup',
      ).errors,
    ).toEqual({
      password: `パスワードが違います。${LOCK}`,
      code: `コードが違うか、使ったことのあるバックアップコードです。${LOCK}`,
    })
  })

  it.each([
    ['names nothing', []],
    [
      'names a value the form does not have',
      [{ field: 'secret', rule: 'invalid' }],
    ],
  ])('should speak of the attempt when the API %s', (_case, values) => {
    expect(afterRefusal({ type: 'invalid', values }, 'app')).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it('should keep to the values the form has when the API names others too', () => {
    expect(
      afterRefusal(
        {
          type: 'invalid',
          values: [
            { field: 'secret', rule: 'invalid' },
            { field: 'code', rule: 'incorrect' },
          ],
        },
        'app',
      ),
    ).toEqual({
      message: undefined,
      errors: {
        code: `コードが違います。認証アプリに表示されている、いまのコードを入力してください。${LOCK}`,
      },
    })
  })

  it.each([
    [
      TOO_MANY_REQUESTS,
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      FAILED,
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])(
    'should speak of the attempt when nothing was sent: %o',
    (outcome, message) => {
      expect(afterRefusal(outcome, 'appOrBackup')).toEqual({
        message,
        errors: {},
      })
    },
  )
})

describe('secretGroupsOf', () => {
  it.each([
    [
      '32 characters',
      'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP',
    ],
    ['a length that four does not divide', 'JBSWY3DPEH', 'JBSW Y3DP EH'],
    ['four characters', 'JBSW', 'JBSW'],
    ['no characters', '', ''],
  ])(
    'should part a secret of %s in groups of four',
    (_case, secret, groups) => {
      expect(secretGroupsOf(secret)).toBe(groups)
    },
  )
})

describe('withTwoFactorStatus', () => {
  it('should give the account that was read the state the API left the second factor in, and change nothing else', () => {
    expect(
      withTwoFactorStatus({ type: 'found', user: account }, 'enabled'),
    ).toEqual({
      type: 'found',
      user: { ...account, twoFactorStatus: 'enabled' },
    })
  })

  it.each([
    ['an account that was not read', undefined],
    ['an account that could not be read', FAILED],
  ])('should leave %s as it is', (_case, read) => {
    expect(withTwoFactorStatus(read, 'disabled')).toBe(read)
  })
})
