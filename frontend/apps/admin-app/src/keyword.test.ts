import { describe, expect, it } from 'vitest'
import { keywordIn, keywordOf, LONGEST_KEYWORD } from './keyword'

const valuesOf = (entries: [string, string][]): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }

  return values
}

describe('keywordIn', () => {
  it.each([
    ['a keyword', 'keyword=%E6%B8%8B%E8%B0%B7', '渋谷'],
    ['a keyword between blanks', 'keyword=+cut+', 'cut'],
    ['no keyword', '', undefined],
    ['an empty keyword', 'keyword=', undefined],
    ['a keyword of blanks', 'keyword=+++', undefined],
    [
      'a keyword the API does not take',
      `keyword=${'a'.repeat(LONGEST_KEYWORD + 1)}`,
      undefined,
    ],
    [
      'the longest keyword the API takes',
      `keyword=${'a'.repeat(LONGEST_KEYWORD)}`,
      'a'.repeat(LONGEST_KEYWORD),
    ],
  ])('should read %s', (_case, query, keyword) => {
    expect(keywordIn(new URLSearchParams(query), 'keyword')).toBe(keyword)
  })

  it('should read the parameter it is told', () => {
    // Arrange
    const query = new URLSearchParams('keyword=%E6%B8%8B%E8%B0%B7&search=090')

    // Act, Assert
    expect(keywordIn(query, 'search')).toBe('090')
  })
})

const FILLED_IN: [string, [string, string][], string | undefined][] = [
  ['a keyword', [['keyword', ' 渋谷 ']], '渋谷'],
  ['an empty field', [['keyword', '']], undefined],
  ['no field', [], undefined],
]

describe('keywordOf', () => {
  it.each(FILLED_IN)('should read %s', (_case, entries, keyword) => {
    expect(keywordOf(valuesOf(entries))).toBe(keyword)
  })
})
