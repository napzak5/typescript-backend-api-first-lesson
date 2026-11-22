import { describe, expect, it } from 'vitest'
import { problemMessages } from './problems'

const JAPANESE = /[぀-ヿ一-鿿]/

describe('problemMessages', () => {
  it.each(
    Object.entries(problemMessages).map(
      ([kind, { title }]): [string, string, string] => [
        kind,
        title.en,
        title.ja,
      ],
    ),
  )('should give the problem %s a title in each language', (_kind, en, ja) => {
    // Assert
    expect(en).toMatch(/^[A-Z][a-z -]+$/)
    expect(ja).toMatch(JAPANESE)
  })
})
