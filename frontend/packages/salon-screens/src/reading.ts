import type { ModelsProblemDetails } from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * What the functions that read from the API share: why nothing was read,
 * a page of a list, and a list read to its end.
 */

/** Why nothing came of a request to read: there is nothing a person could correct. */
export type Unread =
  | { type: 'tooManyRequests' }
  /** No answer, or one that says nothing a person could act on */
  | { type: 'failed' }

/** The address names nothing: no record has this ID, or it was removed. */
export type NotFound = { type: 'notFound' }

/** The account may not see what was asked for: a member of another salon. */
export type Forbidden = { type: 'forbidden' }

/** A value the API refused, with the rule it broke. */
export type RefusedValue = { field: string; rule: string }

/** The values a problem names, with the rules they broke. */
export const refusedValuesOf = ({
  errors,
}: Pick<ModelsProblemDetails, 'errors'>): RefusedValue[] =>
  (errors ?? []).map(({ field, rule }) => ({ field, rule }))

/** One page of a list, and where the next one begins. */
export type Page<Item> = {
  type: 'found'
  items: Item[]
  /** How many items the whole list has; `null` when the API did not count */
  total: number | null
  /** `null` on the last page */
  nextCursor: string | null
}

export const NOT_FOUND: NotFound = { type: 'notFound' }

export const FAILED: Unread = { type: 'failed' }

const TOO_MANY_REQUESTS: Unread = { type: 'tooManyRequests' }

type Problem<Status extends number> = {
  status: Status
  data: ModelsProblemDetails
}

/**
 * The answers that say nothing about what was asked for, and no answer at
 * all. A 400 is among them: the screens send only what the API takes. So is
 * a 401: the screens are behind the session, and one that could not be
 * renewed signs the user out.
 */
export type Refused =
  | Problem<400>
  | Problem<401>
  | Problem<429>
  | Problem<500>
  | null

export const unreadOf = (answer: Refused): Unread =>
  match(answer)
    .returnType<Unread>()
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(null, { status: 400 }, { status: 401 }, { status: 500 }),
      () => FAILED,
    )
    .exhaustive()

/**
 * Why a part of a screen that reads several things is not shown: too many
 * requests when one of them was refused for that, which waiting mends and
 * looking at the connection does not.
 */
export const whyUnread = (
  reads: readonly ({ type: string } | undefined)[],
): Unread =>
  reads.some((read) => read?.type === 'tooManyRequests')
    ? TOO_MANY_REQUESTS
    : FAILED

type ListMeta = { total: number | null; nextCursor: string | null }

export const pageOf = <Item>(items: Item[], meta: ListMeta): Page<Item> => ({
  type: 'found',
  items,
  total: meta.total,
  nextCursor: meta.nextCursor,
})

/** The parameter `cursor` of a list: absent for its first page. */
export const from = (cursor: string | undefined): { cursor?: string } =>
  cursor === undefined ? {} : { cursor }

/**
 * A list that is read to its end is asked for in the largest pages the API
 * gives, and in no more than this many.
 */
export const LARGEST_PAGE = 100
const MOST_PAGES = 10

/**
 * Reads a list to its end, a page at a time. What stops one page stops the
 * list: half a list of names is not shown as the list.
 */
export const toTheEnd = async <
  Item,
  Stopped extends NotFound | Forbidden | Unread,
>(
  readPage: (cursor: string | undefined) => Promise<Page<Item> | Stopped>,
  cursor: string | undefined = undefined,
  read: Item[] = [],
  pagesLeft: number = MOST_PAGES,
): Promise<{ type: 'found'; items: Item[] } | Stopped> => {
  const page = await readPage(cursor)
  if (page.type !== 'found') {
    return page
  }
  const items = [...read, ...page.items]

  return page.nextCursor === null || pagesLeft === 1
    ? { type: 'found', items }
    : toTheEnd(readPage, page.nextCursor, items, pagesLeft - 1)
}

/** Why something could not be read, in words. */
export const unreadMessageOf = (
  what: string,
  reason: Unread | NotFound,
): string =>
  reason.type === 'tooManyRequests'
    ? 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。'
    : `${what}を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。`
