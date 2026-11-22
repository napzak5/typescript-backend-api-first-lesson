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

  it('should name the method and the path of a route that is not there', () => {
    // Act
    const detail = problemMessages.routeNotFound.detail('PUT', '/api/v1/salons')

    // Assert
    expect(detail).toEqual({
      en: 'PUT /api/v1/salons is not part of the API',
      ja: 'PUT /api/v1/salons は、この API にありません',
    })
  })

  it('should name the size a request body may have', () => {
    // Act
    const detail = problemMessages.bodyTooLarge.detail(100_000)

    // Assert
    expect(detail).toEqual({
      en: 'The request body exceeds 100000 bytes',
      ja: 'リクエストの本文が 100000 バイトを超えています',
    })
  })
})
