import { describe, expect, it } from 'vitest'
import { tokenIn } from './mailed-token'

describe('tokenIn', () => {
  it('should read the token that the API puts behind the address of a mailed link', () => {
    expect(tokenIn('#token=Zm9vYmFy_-0123456789abcdefghijklmnopqrstuvw')).toBe(
      'Zm9vYmFy_-0123456789abcdefghijklmnopqrstuvw',
    )
  })

  it.each([
    ['no fragment', ''],
    ['an empty fragment', '#'],
    ['a fragment without a token', '#token='],
    ['another fragment', '#section'],
    ['a token under another name', '#code=abc'],
    ['a token with something behind it', '#token=abc&next=/'],
    ['a token of characters no token has', '#token=abc def'],
    ['a token longer than the API takes', `#token=${'a'.repeat(256)}`],
  ])('should find no token in %s', (_case, hash) => {
    expect(tokenIn(hash)).toBeNull()
  })

  it('should take a token as long as the API takes', () => {
    expect(tokenIn(`#token=${'a'.repeat(255)}`)).toHaveLength(255)
  })
})
