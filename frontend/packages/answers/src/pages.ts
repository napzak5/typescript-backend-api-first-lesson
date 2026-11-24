import {
  FAILED,
  type Forbidden,
  type NotFound,
  type Page,
  type Unread,
} from './reading'

/** What the pages of a list that were read so far amount to. */
export type Listing<Item> =
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

/**
 * Where the page after one begins, for the query that reads the pages.
 * After a read that is no page (not read, refused, or of nothing) there is
 * none: reading on is reading again.
 */
export const cursorAfter = <Item>(
  page: Page<Item> | Unread | Forbidden | NotFound,
): string | undefined =>
  page.type === 'found' ? (page.nextCursor ?? undefined) : undefined

/** The cursor of the first page of a list: there is none. */
export const firstCursor = (): string | undefined => undefined
