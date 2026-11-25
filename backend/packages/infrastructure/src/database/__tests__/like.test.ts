import { describe, expect, it } from 'vitest'
import { containing } from '../like'

describe('containing', () => {
  it('should match a keyword anywhere in the text', () => {
    // Act
    const pattern = containing('青山')

    // Assert
    expect(pattern).toBe('%青山%')
  })

  it.each([
    ['a percent sign', '50%', '%50\\%%'],
    ['an underscore', 'a_b', '%a\\_b%'],
    ['a backslash', 'a\\b', '%a\\\\b%'],
  ])('should take %s literally', (_case, keyword, expected) => {
    // Act
    const pattern = containing(keyword)

    // Assert
    expect(pattern).toBe(expected)
  })
})
