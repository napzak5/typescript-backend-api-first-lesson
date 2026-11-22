import type { ApiPage, Paging } from '../../models/page'

/**
 * Items of a list → the page the API answers with, for a list whose
 * caller says where it goes on: `last` is the cursor of the last item of
 * the page, which the page after it starts behind. Pages are only walked
 * forwards.
 */
export const toApiPageEndingAt = <Item>(
  data: Item[],
  { total, hasMore }: { total: number; hasMore: boolean },
  { limit, after }: Paging<string>,
  last: string | null,
): ApiPage<Item> => ({
  data,
  meta: {
    total,
    limit,
    hasMore,
    cursor: after,
    nextCursor: hasMore ? last : null,
    prevCursor: null,
  },
})

/**
 * Items of a list → the page the API answers with. The cursor of the page
 * after it is the ID of its last item, so a page stays where it is while
 * items are added or removed.
 */
export const toApiPage = <Item extends { id: string }>(
  data: Item[],
  list: { total: number; hasMore: boolean },
  paging: Paging<string>,
): ApiPage<Item> =>
  toApiPageEndingAt(data, list, paging, data.at(-1)?.id ?? null)
