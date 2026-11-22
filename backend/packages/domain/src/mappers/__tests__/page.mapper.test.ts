import { describe, expect, it } from 'vitest'
import { toApiPage, toApiPageEndingAt } from '../read/page'
import { toPaging } from '../write/page'

describe('toPaging', () => {
  it('starts at the beginning of the list, with 20 items, when the request says neither', () => {
    expect(toPaging({})).toEqual({ limit: 20, after: null })
  })

  it('takes the limit and the cursor a request names', () => {
    expect(toPaging({ limit: 5, cursor: 'item-3' })).toEqual({
      limit: 5,
      after: 'item-3',
    })
  })

  it.each<
    [
      string,
      { limit?: number; cursor?: string },
      { limit: number; after: string | null },
    ]
  >([
    ['a limit alone', { limit: 100 }, { limit: 100, after: null }],
    ['a cursor alone', { cursor: 'item-3' }, { limit: 20, after: 'item-3' }],
  ])('takes %s and decides the other', (_named, request, paging) => {
    expect(toPaging(request)).toEqual(paging)
  })
})

describe('toApiPage', () => {
  const items = [{ id: 'item-1' }, { id: 'item-2' }]

  it('answers with the items, the counts of the list and the place of the page', () => {
    expect(
      toApiPage(
        items,
        { total: 7, hasMore: true },
        { limit: 2, after: 'item-0' },
      ),
    ).toEqual({
      data: items,
      meta: {
        total: 7,
        limit: 2,
        hasMore: true,
        cursor: 'item-0',
        nextCursor: 'item-2',
        prevCursor: null,
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      toApiPage(items, { total: 2, hasMore: false }, { limit: 20, after: null })
        .meta,
    ).toEqual({
      total: 2,
      limit: 20,
      hasMore: false,
      cursor: null,
      nextCursor: null,
      prevCursor: null,
    })
  })

  it('names no next page after a page without items', () => {
    expect(
      toApiPage([], { total: 0, hasMore: true }, { limit: 20, after: null })
        .meta.nextCursor,
    ).toBeNull()
  })
})

describe('toApiPageEndingAt', () => {
  const items = [{ name: 'first' }, { name: 'second' }]

  it('answers with the items, the counts of the list, the place of the page and the cursor its caller names', () => {
    expect(
      toApiPageEndingAt(
        items,
        { total: 7, hasMore: true },
        { limit: 2, after: 'before-first' },
        'at-second',
      ),
    ).toEqual({
      data: items,
      meta: {
        total: 7,
        limit: 2,
        hasMore: true,
        cursor: 'before-first',
        nextCursor: 'at-second',
        prevCursor: null,
      },
    })
  })

  it('names no next page when the list ends with this one, whatever its last item is', () => {
    expect(
      toApiPageEndingAt(
        items,
        { total: 2, hasMore: false },
        { limit: 20, after: null },
        'at-second',
      ).meta,
    ).toEqual({
      total: 2,
      limit: 20,
      hasMore: false,
      cursor: null,
      nextCursor: null,
      prevCursor: null,
    })
  })

  it('names no next page when its caller names no last item', () => {
    expect(
      toApiPageEndingAt(
        [],
        { total: 0, hasMore: true },
        { limit: 20, after: null },
        null,
      ).meta.nextCursor,
    ).toBeNull()
  })
})
