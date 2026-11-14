import { describe, expect, it } from 'vitest'
import { salonLinks, salonPageLinks } from '../links'

const meta = {
  total: 5,
  limit: 2,
  hasMore: true,
  cursor: null,
  nextCursor: null,
  prevCursor: null,
}

describe('salonLinks', () => {
  it('links a salon to itself and to the collection', () => {
    expect(salonLinks('/api/v1/salons', 'abc')).toEqual({
      self: '/api/v1/salons/abc',
      list: '/api/v1/salons',
    })
  })
})

describe('salonPageLinks', () => {
  it('links the only page to itself', () => {
    const links = salonPageLinks('/api/v1/salons', '/api/v1/salons', meta)

    expect(links).toEqual({
      self: '/api/v1/salons',
      first: '/api/v1/salons',
      last: null,
      next: null,
      prev: null,
    })
  })

  it('keeps the filters of the request and replaces only the cursor', () => {
    const links = salonPageLinks(
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
