import type { More } from '@beauty-salon-frontend/ui'
import { describe, expect, it } from 'vitest'
import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
} from './pages'
import type { NotFound, Page, Unread } from './salons-api'

const page = (
  items: string[],
  nextCursor: string | null,
  total: number | null = 5,
): Page<string> => ({ type: 'found', items, total, nextCursor })

const FAILED: Unread = { type: 'failed' }
const TOO_MANY: Unread = { type: 'tooManyRequests' }

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
    ['too many requests', TOO_MANY],
    ['a failure', FAILED],
  ])(
    'should be unread, for %s, when the first page was not read',
    (_, reason) => {
      expect(listingOf([reason])).toEqual({ type: 'unread', reason })
    },
  )

  it('should keep what was read before a page that was not, and say that something is missing', () => {
    expect(listingOf([page(['a', 'b'], 'b', 4), TOO_MANY])).toEqual({
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
    expect(cursorAfter(TOO_MANY)).toBeUndefined()
  })
})

describe('firstCursor', () => {
  it('should be none', () => {
    expect(firstCursor()).toBeUndefined()
  })
})

describe('moreOf', () => {
  const IDLE = { nextPage: false, again: false }

  const CASES: [
    Parameters<typeof moreOf>[0],
    Parameters<typeof moreOf>[1],
    More,
  ][] = [
    ['none', IDLE, 'none'],
    ['none', { nextPage: true, again: true }, 'none'],
    ['more', IDLE, 'available'],
    ['more', { nextPage: true, again: false }, 'loading'],
    // The list is read again for another reason: its button stays as it is
    ['more', { nextPage: false, again: true }, 'available'],
    ['unread', IDLE, 'failed'],
    ['unread', { nextPage: false, again: true }, 'loading'],
    ['unread', { nextPage: true, again: false }, 'loading'],
  ]

  it.each(CASES)(
    'should say of a list with the rest %s, fetching %j: %s',
    (rest, fetching, more) => {
      expect(moreOf(rest, fetching)).toBe(more)
    },
  )
})

describe('unreadMessageOf', () => {
  it('should ask for patience when there were too many requests', () => {
    expect(unreadMessageOf('メニュー', TOO_MANY)).toBe(
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    )
  })

  const NOT_READ: [string, Unread | NotFound][] = [
    ['a failure', FAILED],
    ['a part of a salon that the API does not find', { type: 'notFound' }],
  ]

  it.each(NOT_READ)(
    'should name what could not be read after %s',
    (_, reason) => {
      expect(unreadMessageOf('メニュー', reason)).toBe(
        'メニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
    },
  )
})
