import type { Page, Unread } from './reading'

/** What the pages of a list that were read so far amount to. */
type Listing<Item> =
  /** Nothing is there to show: the first page was not read */
  | { type: 'unread'; reason: Unread }
  | {
      type: 'listed'
      items: Item[]
      /** How many items the whole list has; `null` when the API did not count */
      total: number | null
      /**
       * What comes after the items: nothing, a page that was not asked for
       * yet (`more`), or one that was asked for and not read (`unread`)
       */
      rest: 'none' | 'more' | 'unread'
    }

const FAILED: Unread = { type: 'failed' }

/**
 * Puts the pages that were read together. A page that was not read ends the
 * list where it is: what was read before it stays, and the list says that
 * something is missing.
 */
export const listingOf = <Item>(
  pages: readonly (Page<Item> | Unread)[],
): Listing<Item> => {
  const [first] = pages
  const last = pages.at(-1)
  if (first === undefined || last === undefined) {
    return { type: 'unread', reason: FAILED }
  }
  if (first.type !== 'found') {
    return { type: 'unread', reason: first }
  }
  const read = pages.flatMap((page) => (page.type === 'found' ? [page] : []))

  return {
    type: 'listed',
    items: read.flatMap((page) => page.items),
    total: read.at(-1)?.total ?? null,
    rest:
      last.type !== 'found'
        ? 'unread'
        : last.nextCursor === null
          ? 'none'
          : 'more',
  }
}

/** Where the page after one begins, for the query that reads the pages. */
export const cursorAfter = <Item>(
  page: Page<Item> | Unread,
): string | undefined =>
  page.type === 'found' ? (page.nextCursor ?? undefined) : undefined

/** The cursor of the first page of a list: there is none. */
export const firstCursor = (): string | undefined => undefined

/** What the button below a list does, and whether there is one. */
export type More = 'none' | 'available' | 'loading' | 'failed'

/**
 * What comes after the items of a list, for the component that shows them.
 * A page that was not read is asked for again by reading the list again,
 * so it is on its way while the list is.
 */
export const moreOf = (
  rest: 'none' | 'more' | 'unread',
  fetching: { nextPage: boolean; again: boolean },
): More => {
  if (rest === 'none') {
    return 'none'
  }
  if (fetching.nextPage || (rest === 'unread' && fetching.again)) {
    return 'loading'
  }

  return rest === 'unread' ? 'failed' : 'available'
}
