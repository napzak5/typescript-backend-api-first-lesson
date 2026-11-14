import { describe, expect, it } from 'vitest'
import {
  authLoginRequestSchema,
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
