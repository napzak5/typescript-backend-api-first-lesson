import { describe, expect, it } from 'vitest'
import {
  authEmailVerificationConfirmRequestSchema,
  authEmailVerificationSendRequestSchema,
  authLoginRequestSchema,
  authPasswordChangeRequestSchema,
  authPasswordForgotRequestSchema,
  authPasswordResetConfirmRequestSchema,
  authPasswordResetVerifyRequestSchema,
  authRegisterRequestSchema,
  authTokenRefreshRequestSchema,
} from '../schemas/auth.schema'
import { parseWith } from '../shared'
import { PASSWORD } from './auth-fixtures'
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
    ['a two-factor code of 64 characters', { twoFactorCode: 'c'.repeat(64) }],
    ['a remembered session', { rememberMe: true }],
    ['an email of 255 characters', { email: `${'a'.repeat(243)}@example.com` }],
  ])('accepts %s', (_case, change) => {
    expect(rulesBrokenBy(authLoginRequestSchema, loginRequest(change))).toEqual(
      [],
    )
  })

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
