import { describe, expect, it } from 'vitest'
import { pageLinks, queryOf } from '../page-links'

const meta = {
  total: 5,
  limit: 2,
  hasMore: true,
  cursor: null,
  nextCursor: null,
  prevCursor: null,
}

describe('pageLinks', () => {
  it('links the only page to itself', () => {
    const links = pageLinks('/api/v1/salons', '/api/v1/salons', meta)

    expect(links).toEqual({
      self: '/api/v1/salons',
      first: '/api/v1/salons',
      last: null,
      next: null,
      prev: null,
    })
  })

  it('keeps the filters of the request and replaces only the cursor', () => {
    const links = pageLinks(
      '/api/v1/salons',
      '/api/v1/salons?limit=2&features=color&features=kids&cursor=page-2&keyword=a%26b',
      { ...meta, cursor: 'page-2', nextCursor: 'page-3' },
    )

    expect(links).toEqual({
      self: '/api/v1/salons?limit=2&features=color&features=kids&keyword=a%26b&cursor=page-2',
      first:
        '/api/v1/salons?limit=2&features=color&features=kids&keyword=a%26b',
      last: null,
      next: '/api/v1/salons?limit=2&features=color&features=kids&keyword=a%26b&cursor=page-3',
      prev: null,
    })
  })
})

describe('queryOf', () => {
  it.each([
    [
      'a URL with a query',
      '/api/v1/salons?limit=2&city=Tokyo',
      'limit=2&city=Tokyo',
    ],
    ['a URL without a query', '/api/v1/salons', ''],
    ['a URL that ends in a question mark', '/api/v1/salons?', ''],
    [
      'a query that contains a question mark',
      '/api/v1/salons?keyword=a?b',
      'keyword=a?b',
    ],
    ['a query alone', '?limit=2', 'limit=2'],
    ['an empty URL', '', ''],
  ])(
    'returns the query of %s without the question mark',
    (_case, url, query) => {
      expect(queryOf(url)).toBe(query)
    },
  )
})
