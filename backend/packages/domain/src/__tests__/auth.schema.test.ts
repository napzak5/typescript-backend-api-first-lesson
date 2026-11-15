import { describe, expect, it } from 'vitest'
import { parseSessionId, parseUserId } from '../models/auth'
import {
  authEmailVerificationConfirmRequestSchema,
  authEmailVerificationSendRequestSchema,
  authLoginRequestSchema,
  authPasswordChangeRequestSchema,
  authPasswordForgotRequestSchema,
  authPasswordResetConfirmRequestSchema,
  authPasswordResetVerifyRequestSchema,
  authRegisterRequestSchema,
  authStaffInvitationAcceptRequestSchema,
  authStaffInvitationVerifyRequestSchema,
  authTokenRefreshRequestSchema,
  authTwoFactorBackupCodesRequestSchema,
  authTwoFactorDisableRequestSchema,
  authTwoFactorEnableRequestSchema,
  authTwoFactorVerifyRequestSchema,
  sessionSearchRequestSchema,
} from '../schemas/auth.schema'
import { parseWith } from '../shared'
import { PASSWORD, SESSION_ID, USER_ID } from './auth-fixtures'
import { brokenRules } from './fixtures'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** "café …" as one code point for é (NFC) and as e followed by a combining accent (NFD). */
const COMPOSED = 'caf\u00e9 au lait at dawn'
const DECOMPOSED = 'cafe\u0301 au lait at dawn'

/** A character outside the basic plane: one code point, two UTF-16 units. */
const BLOSSOM = '🌸'

/** A password that is long enough and on no blocklist. */
const NEW_PASSWORD = 'violet tram under the bridge'

const loginRequest = (overrides: Record<string, unknown> = {}) => ({
  email: 'hanako@example.com',
  password: PASSWORD,
  rememberMe: false,
  twoFactorCode: null,
  ...overrides,
})

describe('authLoginRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = loginRequest()

    const result = parseWith(authLoginRequestSchema, request, 'Invalid')

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('turns the email into lower case', () => {
    const result = parseWith(
      authLoginRequestSchema,
      loginRequest({ email: 'Hanako.Yamada@Example.COM' }),
      'Invalid',
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { email: 'hanako.yamada@example.com' },
    })
  })

  it.each([
    ['a password of one character', { password: 'x' }],
    ['a password of 128 characters', { password: 'p'.repeat(128) }],
    ['a two-factor code', { twoFactorCode: '123456' }],
    ['a two-factor code of one character', { twoFactorCode: 'c' }],
    ['a two-factor code of 64 characters', { twoFactorCode: 'c'.repeat(64) }],
    ['no two-factor code', { twoFactorCode: null }],
    ['a remembered session', { rememberMe: true }],
    ['an email of 255 characters', { email: `${'a'.repeat(243)}@example.com` }],
  ])('accepts %s', (_case, change) => {
    expect(rulesBrokenBy(authLoginRequestSchema, loginRequest(change))).toEqual(
      [],
    )
  })

  it.each([
    ['as it was shown', 'ABCD-EFGH-IJKL-MNOP'],
    ['in lower case with spaces around and between', ' abcd efgh ijkl mnop '],
  ])(
    'returns a backup code typed %s as the two-factor code, unchanged',
    (_case, twoFactorCode) => {
      const result = parseWith(
        authLoginRequestSchema,
        loginRequest({ twoFactorCode }),
        'Invalid',
      )

      expect(result).toMatchObject({
        type: 'success',
        data: { twoFactorCode },
      })
    },
  )

  it('turns the password into NFC', () => {
    const result = parseWith(
      authLoginRequestSchema,
      loginRequest({ password: DECOMPOSED }),
      'Invalid',
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { password: COMPOSED },
    })
  })

  it('counts the length of the password in code points', () => {
    expect(
      rulesBrokenBy(
        authLoginRequestSchema,
        loginRequest({ password: BLOSSOM.repeat(128) }),
      ),
    ).toEqual([])
    expect(
      rulesBrokenBy(
        authLoginRequestSchema,
        loginRequest({ password: BLOSSOM.repeat(129) }),
      ),
    ).toEqual(['password:too_big'])
  })

  it('does not hold a presented password to the rules for new passwords', () => {
    expect(
      rulesBrokenBy(
        authLoginRequestSchema,
        loginRequest({ password: 'correct horse battery staple' }),
      ),
    ).toEqual([])
  })

  it.each([
    ['a missing email', { email: undefined }, ['email:invalid_type']],
    ['a missing password', { password: undefined }, ['password:invalid_type']],
    [
      'a missing rememberMe',
      { rememberMe: undefined },
      ['rememberMe:invalid_type'],
    ],
    [
      'a missing twoFactorCode',
      { twoFactorCode: undefined },
      ['twoFactorCode:invalid_type'],
    ],
    [
      'an unknown property',
      { deviceId: 'phone' },
      ['deviceId:unrecognized_keys'],
    ],
    ['an email that is not one', { email: 'hanako' }, ['email:invalid_format']],
    [
      'an email over 255 characters',
      { email: `${'a'.repeat(244)}@example.com` },
      ['email:too_big'],
    ],
    ['an empty password', { password: '' }, ['password:too_small']],
    [
      'a password over 128 characters',
      { password: 'p'.repeat(129) },
      ['password:too_big'],
    ],
    [
      'a password that is a number',
      { password: 1234 },
      ['password:invalid_type'],
    ],
    [
      'a rememberMe that is a string',
      { rememberMe: 'true' },
      ['rememberMe:invalid_type'],
    ],
    ['an email that is null', { email: null }, ['email:invalid_type']],
    [
      'an empty two-factor code',
      { twoFactorCode: '' },
      ['twoFactorCode:too_small'],
    ],
    [
      'a two-factor code over 64 characters',
      { twoFactorCode: 'c'.repeat(65) },
      ['twoFactorCode:too_big'],
    ],
    [
      'a two-factor code that is a number',
      { twoFactorCode: 123456 },
      ['twoFactorCode:invalid_type'],
    ],
  ])('rejects %s', (_case, change, expected) => {
    expect(rulesBrokenBy(authLoginRequestSchema, loginRequest(change))).toEqual(
      expected,
    )
  })

  it.each([
    ['null', null],
    ['an array', [loginRequest()]],
    ['a string', 'hanako@example.com'],
  ])('rejects %s as the request', (_case, input) => {
    expect(rulesBrokenBy(authLoginRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('authTokenRefreshRequestSchema', () => {
  it.each([
    ['a token of one character', 'r'],
    ['a token of 43 characters', 'r'.repeat(43)],
    ['a token of 255 characters', 'r'.repeat(255)],
  ])('accepts %s and returns it unchanged', (_case, refreshToken) => {
    const result = parseWith(
      authTokenRefreshRequestSchema,
      { refreshToken },
      'Invalid',
    )

    expect(result).toEqual({ type: 'success', data: { refreshToken } })
  })

  it.each([
    ['a missing token', {}, ['refreshToken:invalid_type']],
    ['an empty token', { refreshToken: '' }, ['refreshToken:too_small']],
    [
      'a token over 255 characters',
      { refreshToken: 'r'.repeat(256) },
      ['refreshToken:too_big'],
    ],
    [
      'a token that is null',
      { refreshToken: null },
      ['refreshToken:invalid_type'],
    ],
    [
      'an unknown property',
      { refreshToken: 'r', rememberMe: true },
      ['rememberMe:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(authTokenRefreshRequestSchema, input)).toEqual(
      expected,
    )
  })
})

describe('authRegisterRequestSchema', () => {
  const registration = (overrides: Record<string, unknown> = {}) => ({
    email: 'hanako@example.com',
    password: NEW_PASSWORD,
    ...overrides,
  })

  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = registration()

    const result = parseWith(authRegisterRequestSchema, request, 'Invalid')

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('turns the email into lower case and the password into NFC', () => {
    const result = parseWith(
      authRegisterRequestSchema,
      registration({
        email: 'Hanako.Yamada@Example.COM',
        password: DECOMPOSED,
      }),
      'Invalid',
    )

    expect(result).toEqual({
      type: 'success',
      data: { email: 'hanako.yamada@example.com', password: COMPOSED },
    })
  })

  it.each([
    ['a password of 15 characters', 'violet tram und'],
    ['a password of 15 characters outside the basic plane', BLOSSOM.repeat(15)],
    ['a password of 128 characters', 'p'.repeat(128)],
    [
      'a password of 128 characters outside the basic plane',
      BLOSSOM.repeat(128),
    ],
    [
      '15 lower-case letters, with no other kind of character',
      'quietmorningtea',
    ],
    ['a password with spaces only between words', 'a b c d e f g h'],
  ])('accepts %s', (_case, password) => {
    expect(
      rulesBrokenBy(authRegisterRequestSchema, registration({ password })),
    ).toEqual([])
  })

  it.each([
    ['a missing email', { email: undefined }, ['email:invalid_type']],
    ['a missing password', { password: undefined }, ['password:invalid_type']],
    ['an unknown property', { name: 'Hanako' }, ['name:unrecognized_keys']],
    ['an email that is not one', { email: 'hanako' }, ['email:invalid_format']],
    [
      'an email over 255 characters',
      { email: `${'a'.repeat(244)}@example.com` },
      ['email:too_big'],
    ],
    ['an empty password', { password: '' }, ['password:too_small']],
    [
      'a password of 14 characters',
      { password: 'violet tram un' },
      ['password:too_small'],
    ],
    [
      'a password of 14 characters outside the basic plane, 28 UTF-16 units',
      { password: BLOSSOM.repeat(14) },
      ['password:too_small'],
    ],
    [
      'a password of 129 characters',
      { password: 'p'.repeat(129) },
      ['password:too_big'],
    ],
    [
      'a password of 129 characters outside the basic plane',
      { password: BLOSSOM.repeat(129) },
      ['password:too_big'],
    ],
    ['a password that is a number', { password: 1 }, ['password:invalid_type']],
    ['an email that is null', { email: null }, ['email:invalid_type']],
  ])('rejects %s', (_case, change, expected) => {
    expect(
      rulesBrokenBy(authRegisterRequestSchema, registration(change)),
    ).toEqual(expected)
  })

  it('accepts an email of 255 characters', () => {
    expect(
      rulesBrokenBy(
        authRegisterRequestSchema,
        registration({ email: `${'a'.repeat(243)}@example.com` }),
      ),
    ).toEqual([])
  })

  it.each([
    ['null', null],
    ['an array', [registration()]],
  ])('rejects %s as the request', (_case, input) => {
    expect(rulesBrokenBy(authRegisterRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe.each([
  [
    'authEmailVerificationSendRequestSchema',
    authEmailVerificationSendRequestSchema,
  ],
  ['authPasswordForgotRequestSchema', authPasswordForgotRequestSchema],
])('%s', (_name, schema) => {
  it('turns the email into lower case', () => {
    const result = parseWith(schema, { email: 'Hanako@Example.COM' }, 'Invalid')

    expect(result).toEqual({
      type: 'success',
      data: { email: 'hanako@example.com' },
    })
  })

  it.each([
    ['a missing email', {}, ['email:invalid_type']],
    ['an email that is not one', { email: 'hanako' }, ['email:invalid_format']],
    [
      'an email over 255 characters',
      { email: `${'a'.repeat(244)}@example.com` },
      ['email:too_big'],
    ],
    [
      'an unknown property',
      { email: 'hanako@example.com', password: NEW_PASSWORD },
      ['password:unrecognized_keys'],
    ],
    ['an email that is a number', { email: 1 }, ['email:invalid_type']],
    ['null as the request', null, [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(schema, input)).toEqual(expected)
  })
})

describe.each([
  [
    'authEmailVerificationConfirmRequestSchema',
    authEmailVerificationConfirmRequestSchema,
  ],
  [
    'authPasswordResetVerifyRequestSchema',
    authPasswordResetVerifyRequestSchema,
  ],
  [
    'authStaffInvitationVerifyRequestSchema',
    authStaffInvitationVerifyRequestSchema,
  ],
])('%s', (_name, schema) => {
  it.each([
    ['a token of one character', 't'],
    [
      'a mailed token, in mixed case with - and _',
      'Ab-_9zYx'.repeat(5).slice(0, 43),
    ],
    ['a token of 255 characters', 't'.repeat(255)],
  ])('accepts %s and returns it unchanged', (_case, token) => {
    expect(parseWith(schema, { token }, 'Invalid')).toEqual({
      type: 'success',
      data: { token },
    })
  })

  it.each([
    ['a missing token', {}, ['token:invalid_type']],
    ['an empty token', { token: '' }, ['token:too_small']],
    [
      'a token over 255 characters',
      { token: 't'.repeat(256) },
      ['token:too_big'],
    ],
    ['a token that is null', { token: null }, ['token:invalid_type']],
    [
      'an unknown property',
      { token: 't', email: 'hanako@example.com' },
      ['email:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(schema, input)).toEqual(expected)
  })
})

describe('authPasswordResetConfirmRequestSchema', () => {
  const reset = (overrides: Record<string, unknown> = {}) => ({
    token: 'mailed-token',
    newPassword: NEW_PASSWORD,
    ...overrides,
  })

  it('accepts a request that satisfies every rule and turns the new password into NFC', () => {
    expect(
      parseWith(
        authPasswordResetConfirmRequestSchema,
        reset({ newPassword: DECOMPOSED }),
        'Invalid',
      ),
    ).toEqual({
      type: 'success',
      data: { token: 'mailed-token', newPassword: COMPOSED },
    })
  })

  it.each([
    ['a missing token', { token: undefined }, ['token:invalid_type']],
    ['an empty token', { token: '' }, ['token:too_small']],
    [
      'a token over 255 characters',
      { token: 't'.repeat(256) },
      ['token:too_big'],
    ],
    [
      'a missing new password',
      { newPassword: undefined },
      ['newPassword:invalid_type'],
    ],
    [
      'a new password of 14 characters outside the basic plane',
      { newPassword: BLOSSOM.repeat(14) },
      ['newPassword:too_small'],
    ],
    [
      'a new password of 129 characters outside the basic plane',
      { newPassword: BLOSSOM.repeat(129) },
      ['newPassword:too_big'],
    ],
    [
      'an unknown property',
      { password: NEW_PASSWORD },
      ['password:unrecognized_keys'],
    ],
    [
      'an empty token and a short password',
      { token: '', newPassword: 'short' },
      ['token:too_small', 'newPassword:too_small'],
    ],
  ])('rejects %s', (_case, change, expected) => {
    expect(
      rulesBrokenBy(authPasswordResetConfirmRequestSchema, reset(change)),
    ).toEqual(expected)
  })
})

describe('authStaffInvitationAcceptRequestSchema', () => {
  const acceptance = (overrides: Record<string, unknown> = {}) => ({
    token: 'mailed-token',
    password: NEW_PASSWORD,
    ...overrides,
  })

  it('accepts a request that satisfies every rule and turns the password into NFC', () => {
    expect(
      parseWith(
        authStaffInvitationAcceptRequestSchema,
        acceptance({ password: DECOMPOSED }),
        'Invalid',
      ),
    ).toEqual({
      type: 'success',
      data: { token: 'mailed-token', password: COMPOSED },
    })
  })

  it.each([
    ['a token of one character', { token: 't' }],
    ['a token of 255 characters', { token: 't'.repeat(255) }],
    [
      'a password of 15 characters outside the basic plane',
      { password: BLOSSOM.repeat(15) },
    ],
    [
      'a password of 128 characters outside the basic plane',
      { password: BLOSSOM.repeat(128) },
    ],
  ])('accepts %s', (_case, change) => {
    expect(
      rulesBrokenBy(authStaffInvitationAcceptRequestSchema, acceptance(change)),
    ).toEqual([])
    expect(
      parseWith(
        authStaffInvitationAcceptRequestSchema,
        acceptance(change),
        'Invalid',
      ),
    ).toEqual({ type: 'success', data: acceptance(change) })
  })

  it.each([
    ['a missing token', { token: undefined }, ['token:invalid_type']],
    ['an empty token', { token: '' }, ['token:too_small']],
    [
      'a token over 255 characters',
      { token: 't'.repeat(256) },
      ['token:too_big'],
    ],
    ['a missing password', { password: undefined }, ['password:invalid_type']],
    ['a password that is null', { password: null }, ['password:invalid_type']],
    [
      'a password of 14 characters outside the basic plane',
      { password: BLOSSOM.repeat(14) },
      ['password:too_small'],
    ],
    [
      'a password of 129 characters outside the basic plane',
      { password: BLOSSOM.repeat(129) },
      ['password:too_big'],
    ],
    [
      'the name the password has in a password reset',
      { password: undefined, newPassword: NEW_PASSWORD },
      ['password:invalid_type', 'newPassword:unrecognized_keys'],
    ],
    [
      'an address for the account',
      { email: 'hanako@example.com' },
      ['email:unrecognized_keys'],
    ],
    ['a role for the account', { role: 'owner' }, ['role:unrecognized_keys']],
    [
      'an empty token and a short password',
      { token: '', password: 'short' },
      ['token:too_small', 'password:too_small'],
    ],
  ])('rejects %s', (_case, change, expected) => {
    expect(
      rulesBrokenBy(authStaffInvitationAcceptRequestSchema, acceptance(change)),
    ).toEqual(expected)
  })

  it('rejects null as the request', () => {
    expect(rulesBrokenBy(authStaffInvitationAcceptRequestSchema, null)).toEqual(
      [':invalid_type'],
    )
  })
})

describe('authPasswordChangeRequestSchema', () => {
  const change = (overrides: Record<string, unknown> = {}) => ({
    currentPassword: PASSWORD,
    newPassword: NEW_PASSWORD,
    ...overrides,
  })

  it('accepts a request that satisfies every rule and turns both passwords into NFC', () => {
    expect(
      parseWith(
        authPasswordChangeRequestSchema,
        change({ currentPassword: DECOMPOSED, newPassword: `${DECOMPOSED}!` }),
        'Invalid',
      ),
    ).toEqual({
      type: 'success',
      data: { currentPassword: COMPOSED, newPassword: `${COMPOSED}!` },
    })
  })

  it.each([
    ['a current password of one character', { currentPassword: 'x' }],
    [
      'a current password of 128 characters outside the basic plane',
      { currentPassword: BLOSSOM.repeat(128) },
    ],
    [
      'a new password of 15 characters outside the basic plane',
      { newPassword: BLOSSOM.repeat(15) },
    ],
  ])('accepts %s', (_case, overrides) => {
    expect(
      rulesBrokenBy(authPasswordChangeRequestSchema, change(overrides)),
    ).toEqual([])
  })

  it.each([
    [
      'an empty current password',
      { currentPassword: '' },
      ['currentPassword:too_small'],
    ],
    [
      'a current password of 129 characters outside the basic plane',
      { currentPassword: BLOSSOM.repeat(129) },
      ['currentPassword:too_big'],
    ],
    [
      'a new password of 14 characters',
      { newPassword: 'violet tram un' },
      ['newPassword:too_small'],
    ],
    [
      'a new password of 129 characters',
      { newPassword: 'n'.repeat(129) },
      ['newPassword:too_big'],
    ],
    [
      'a missing current password',
      { currentPassword: undefined },
      ['currentPassword:invalid_type'],
    ],
    [
      'an unknown property',
      { newPasswordAgain: NEW_PASSWORD },
      ['newPasswordAgain:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, overrides, expected) => {
    expect(
      rulesBrokenBy(authPasswordChangeRequestSchema, change(overrides)),
    ).toEqual(expected)
  })
})

describe('authTwoFactorEnableRequestSchema', () => {
  it('accepts the password and turns it into NFC', () => {
    expect(
      parseWith(
        authTwoFactorEnableRequestSchema,
        { password: DECOMPOSED },
        'Invalid',
      ),
    ).toEqual({ type: 'success', data: { password: COMPOSED } })
  })

  it.each([
    ['a password of one character', 'x'],
    [
      'a password of 128 characters outside the basic plane',
      BLOSSOM.repeat(128),
    ],
    ['a password that may no longer be chosen', PASSWORD],
  ])('accepts %s', (_case, password) => {
    expect(
      rulesBrokenBy(authTwoFactorEnableRequestSchema, { password }),
    ).toEqual([])
  })

  it.each([
    ['a missing password', {}, ['password:invalid_type']],
    ['an empty password', { password: '' }, ['password:too_small']],
    [
      'a password of 129 characters outside the basic plane',
      { password: BLOSSOM.repeat(129) },
      ['password:too_big'],
    ],
    ['a password that is a number', { password: 1 }, ['password:invalid_type']],
    ['a password that is null', { password: null }, ['password:invalid_type']],
    [
      'an unknown property',
      { password: PASSWORD, code: '123456' },
      ['code:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
    ['an array as the request', [{ password: PASSWORD }], [':invalid_type']],
    ['a string as the request', PASSWORD, [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(authTwoFactorEnableRequestSchema, input)).toEqual(
      expected,
    )
  })
})

describe('authTwoFactorVerifyRequestSchema', () => {
  it.each([
    ['six digits', '492039'],
    ['six zeros', '000000'],
    ['six nines', '999999'],
  ])('accepts %s and returns them unchanged', (_case, code) => {
    expect(
      parseWith(authTwoFactorVerifyRequestSchema, { code }, 'Invalid'),
    ).toEqual({ type: 'success', data: { code } })
  })

  it.each([
    ['five digits', { code: '49203' }, ['code:invalid_format']],
    ['seven digits', { code: '4920390' }, ['code:invalid_format']],
    ['an empty code', { code: '' }, ['code:invalid_format']],
    ['six digits with a space', { code: '492 039' }, ['code:invalid_format']],
    [
      'six digits with a space before them',
      { code: ' 492039' },
      ['code:invalid_format'],
    ],
    [
      'six digits followed by a line break',
      { code: '492039\n' },
      ['code:invalid_format'],
    ],
    [
      'six full-width digits',
      { code: '４９２０３９' },
      ['code:invalid_format'],
    ],
    ['six letters', { code: 'abcdef' }, ['code:invalid_format']],
    ['a signed number', { code: '-49203' }, ['code:invalid_format']],
    ['a backup code', { code: 'ABCD-EFGH-IJKL-MNOP' }, ['code:invalid_format']],
    [
      'a backup code without hyphens',
      { code: 'ABCDEFGHIJKLMNOP' },
      ['code:invalid_format'],
    ],
    ['a code that is a number', { code: 492039 }, ['code:invalid_type']],
    ['a code that is null', { code: null }, ['code:invalid_type']],
    ['a missing code', {}, ['code:invalid_type']],
    [
      'an unknown property',
      { code: '492039', password: PASSWORD },
      ['password:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
    ['an array as the request', [{ code: '492039' }], [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(authTwoFactorVerifyRequestSchema, input)).toEqual(
      expected,
    )
  })
})

describe('authTwoFactorDisableRequestSchema', () => {
  const disableRequest = (overrides: Record<string, unknown> = {}) => ({
    password: PASSWORD,
    code: '492039',
    ...overrides,
  })

  it('accepts the password with a code and turns the password into NFC', () => {
    expect(
      parseWith(
        authTwoFactorDisableRequestSchema,
        disableRequest({ password: DECOMPOSED }),
        'Invalid',
      ),
    ).toEqual({ type: 'success', data: { password: COMPOSED, code: '492039' } })
  })

  it.each([
    ['a code of one character', 'c'],
    ['a code of 64 characters', 'c'.repeat(64)],
    ['a backup code as it was shown', 'ABCD-EFGH-IJKL-MNOP'],
    ['a backup code in lower case with spaces', ' abcd efgh ijkl mnop '],
  ])('accepts %s and returns it unchanged', (_case, code) => {
    expect(
      parseWith(
        authTwoFactorDisableRequestSchema,
        disableRequest({ code }),
        'Invalid',
      ),
    ).toEqual({ type: 'success', data: { password: PASSWORD, code } })
  })

  it.each([
    ['a missing password', { password: undefined }, ['password:invalid_type']],
    ['an empty password', { password: '' }, ['password:too_small']],
    [
      'a password of 129 characters',
      { password: 'p'.repeat(129) },
      ['password:too_big'],
    ],
    ['a missing code', { code: undefined }, ['code:invalid_type']],
    ['an empty code', { code: '' }, ['code:too_small']],
    ['a code of 65 characters', { code: 'c'.repeat(65) }, ['code:too_big']],
    ['a code that is a number', { code: 492039 }, ['code:invalid_type']],
    ['a code that is null', { code: null }, ['code:invalid_type']],
    [
      'an unknown property',
      { twoFactorCode: '492039' },
      ['twoFactorCode:unrecognized_keys'],
    ],
    [
      'an empty password and an empty code',
      { password: '', code: '' },
      ['password:too_small', 'code:too_small'],
    ],
  ])('rejects %s', (_case, change, expected) => {
    expect(
      rulesBrokenBy(authTwoFactorDisableRequestSchema, disableRequest(change)),
    ).toEqual(expected)
  })

  it.each([
    ['null', null],
    ['an array', [disableRequest()]],
  ])('rejects %s as the request', (_case, input) => {
    expect(rulesBrokenBy(authTwoFactorDisableRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('authTwoFactorBackupCodesRequestSchema', () => {
  it.each([
    ['the code of an app', '492039'],
    ['a code of one character', 'c'],
    ['a code of 64 characters', 'c'.repeat(64)],
    ['a backup code as it was shown', 'ABCD-EFGH-IJKL-MNOP'],
    ['a backup code in lower case with spaces', ' abcd efgh ijkl mnop '],
  ])('accepts %s and returns it unchanged', (_case, code) => {
    expect(
      parseWith(authTwoFactorBackupCodesRequestSchema, { code }, 'Invalid'),
    ).toEqual({ type: 'success', data: { code } })
  })

  it.each([
    ['a missing code', {}, ['code:invalid_type']],
    ['an empty code', { code: '' }, ['code:too_small']],
    ['a code of 65 characters', { code: 'c'.repeat(65) }, ['code:too_big']],
    ['a code that is a number', { code: 492039 }, ['code:invalid_type']],
    ['a code that is null', { code: null }, ['code:invalid_type']],
    [
      'a password next to the code',
      { code: '492039', password: PASSWORD },
      ['password:unrecognized_keys'],
    ],
    ['null as the request', null, [':invalid_type']],
    ['an array as the request', [{ code: '492039' }], [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(authTwoFactorBackupCodesRequestSchema, input)).toEqual(
      expected,
    )
  })
})

describe('sessionSearchRequestSchema', () => {
  it.each([
    ['no parameter', {}],
    ['a limit of 1', { limit: 1 }],
    ['a limit of 100', { limit: 100 }],
    ['a cursor that is the ID of a session', { cursor: SESSION_ID }],
    ['a limit and a cursor', { limit: 20, cursor: SESSION_ID }],
  ])('accepts %s and returns it unchanged', (_case, query) => {
    expect(parseWith(sessionSearchRequestSchema, query, 'Invalid')).toEqual({
      type: 'success',
      data: query,
    })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a negative limit', { limit: -1 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    [
      'a limit that is not a whole number',
      { limit: 1.5 },
      ['limit:invalid_type'],
    ],
    ['a limit that is text', { limit: '10' }, ['limit:invalid_type']],
    ['a limit that is null', { limit: null }, ['limit:invalid_type']],
    [
      'a cursor that is not a UUID',
      { cursor: 'offset:20' },
      ['cursor:invalid_format'],
    ],
    ['an empty cursor', { cursor: '' }, ['cursor:invalid_format']],
    ['a cursor that is a number', { cursor: 20 }, ['cursor:invalid_type']],
    ['an unknown parameter', { page: 2 }, ['page:unrecognized_keys']],
    [
      'two unknown parameters',
      { page: 2, sort: 'createdAt' },
      ['page:unrecognized_keys', 'sort:unrecognized_keys'],
    ],
    [
      'a limit and a cursor that are both wrong',
      { limit: 0, cursor: 'x' },
      ['limit:too_small', 'cursor:invalid_format'],
    ],
    ['null as the query', null, [':invalid_type']],
    ['an array as the query', [{ limit: 1 }], [':invalid_type']],
  ])('rejects %s', (_case, query, expected) => {
    expect(rulesBrokenBy(sessionSearchRequestSchema, query)).toEqual(expected)
  })
})

describe('parseUserId', () => {
  it('returns a UUID as the ID of a user', () => {
    expect(parseUserId(USER_ID)).toEqual({ type: 'success', data: USER_ID })
  })

  it('returns an ID written in upper case as the lower-case ID', () => {
    expect(parseUserId(USER_ID.toUpperCase())).toEqual({
      type: 'success',
      data: USER_ID,
    })
  })

  it.each<[string, unknown, string]>([
    ['a word', 'me', 'userId:invalid_format'],
    ['an empty ID', '', 'userId:invalid_format'],
    [
      'a UUID with a character too many',
      `${USER_ID}0`,
      'userId:invalid_format',
    ],
    ['a UUID with spaces around it', ` ${USER_ID} `, 'userId:invalid_format'],
    ['a number', 42, 'userId:invalid_type'],
    ['nothing', undefined, 'userId:invalid_type'],
  ])('rejects %s as a validation error of userId', (_case, id, rule) => {
    const result = parseUserId(id)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      rule,
    ])
  })
})

describe('parseSessionId', () => {
  it('returns a UUID as the ID of a session', () => {
    expect(parseSessionId(SESSION_ID)).toEqual({
      type: 'success',
      data: SESSION_ID,
    })
  })

  it('returns an ID written in upper case as the lower-case ID', () => {
    expect(parseSessionId(SESSION_ID.toUpperCase())).toEqual({
      type: 'success',
      data: SESSION_ID,
    })
  })

  it.each<[string, unknown, string]>([
    ['a word', 'current', 'sessionId:invalid_format'],
    ['an empty ID', '', 'sessionId:invalid_format'],
    [
      'a UUID with a character too many',
      `${SESSION_ID}0`,
      'sessionId:invalid_format',
    ],
    ['a number', 42, 'sessionId:invalid_type'],
    ['nothing', undefined, 'sessionId:invalid_type'],
  ])('rejects %s as a validation error of sessionId', (_case, id, rule) => {
    const result = parseSessionId(id)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      rule,
    ])
  })
})
