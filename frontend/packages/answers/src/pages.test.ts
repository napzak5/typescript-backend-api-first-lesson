import { describe, expect, it } from 'vitest'
import { cursorAfter, firstCursor, listingOf } from './pages'
import { FAILED, type Page, TOO_MANY_REQUESTS } from './reading'

const page = (
  items: string[],
  nextCursor: string | null,
  total: number | null = 5,
): Page<string> => ({ type: 'found', items, total, nextCursor })

describe('listingOf', () => {
  it('should put the items of the pages together, in their order', () => {
    expect(
      listingOf([
        page(['a', 'b'], 'b'),
        page(['c', 'd'], 'd'),
        page(['e'], null),
      ]),
    ).toEqual({
      type: 'listed',
      items: ['a', 'b', 'c', 'd', 'e'],
      total: 5,
      rest: 'none',
    })
  })

  it('should say that there is more after a page that names a next one', () => {
    expect(listingOf([page(['a', 'b'], 'b')])).toMatchObject({
      items: ['a', 'b'],
      rest: 'more',
    })
  })

  it('should count as the API counted last', () => {
    expect(listingOf([page(['a'], 'a', 2), page(['b'], 'b', 3)])).toMatchObject(
      { total: 3 },
    )
    expect(listingOf([page(['a'], null, null)])).toMatchObject({ total: null })
  })

  it('should list nothing for a page without an item', () => {
    expect(listingOf([page([], null, 0)])).toEqual({
      type: 'listed',
      items: [],
      total: 0,
      rest: 'none',
    })
  })

  it.each([
    ['too many requests', TOO_MANY_REQUESTS],
    ['a failure', FAILED],
  ])(
    'should be unread, for %s, when the first page was not read',
    (_, reason) => {
      expect(listingOf([reason])).toEqual({ type: 'unread', reason })
    },
  )

  it('should keep what was read before a page that was not, and say that something is missing', () => {
    expect(listingOf([page(['a', 'b'], 'b', 4), TOO_MANY_REQUESTS])).toEqual({
      type: 'listed',
      items: ['a', 'b'],
      total: 4,
      rest: 'unread',
    })
  })

  it('should be unread when there is no page at all', () => {
    expect(listingOf([])).toEqual({ type: 'unread', reason: FAILED })
  })
})

describe('cursorAfter', () => {
  it('should be the cursor a page names', () => {
    expect(cursorAfter(page(['a'], 'a'))).toBe('a')
  })

  it('should be none after the last page', () => {
    expect(cursorAfter(page(['a'], null))).toBeUndefined()
  })

  it('should be none after a page that was not read: reading on is reading again', () => {
    expect(cursorAfter(FAILED)).toBeUndefined()
    expect(cursorAfter(TOO_MANY_REQUESTS)).toBeUndefined()
  })
})

describe('firstCursor', () => {
  it('should be none', () => {
    expect(firstCursor()).toBeUndefined()
  })
})
