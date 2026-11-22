import { describe, expect, it } from 'vitest'
import { keywordError, keywordIn, keywordOf, LONGEST_KEYWORD } from './keyword'

const valuesOf = (entries: [string, string][]): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }

  return values
}

describe('keywordIn', () => {
  it.each<[string, string, string | undefined]>([
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
    [
      'the longest keyword of characters outside the basic plane',
      `keyword=${encodeURIComponent('𠮷'.repeat(LONGEST_KEYWORD))}`,
      '𠮷'.repeat(LONGEST_KEYWORD),
    ],
    [
      'a keyword one such character too long',
      `keyword=${encodeURIComponent('𠮷'.repeat(LONGEST_KEYWORD + 1))}`,
      undefined,
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

describe('keywordError', () => {
  it.each<[string, string, string | undefined]>([
    ['an empty keyword', '', undefined],
    ['the longest keyword', 'あ'.repeat(100), undefined],
    [
      'a keyword one character too long',
      'あ'.repeat(101),
      'キーワードは、100 文字以内で入力してください。',
    ],
    [
      'the longest keyword of characters outside the basic plane',
      '😀'.repeat(100),
      undefined,
    ],
    [
      'a keyword one such character too long',
      '😀'.repeat(101),
      'キーワードは、100 文字以内で入力してください。',
    ],
  ])('should tell what is wrong with %s', (_case, keyword, said) => {
    expect(keywordError(keyword)).toBe(said)
  })
})

describe('keywordOf', () => {
  it.each(FILLED_IN)('should read %s', (_case, entries, keyword) => {
    expect(keywordOf(valuesOf(entries))).toBe(keyword)
  })
})
