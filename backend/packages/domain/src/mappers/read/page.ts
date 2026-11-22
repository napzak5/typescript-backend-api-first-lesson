import type { ApiPage, Paging } from '../../models/page'

/**
 * Items of a list → the page the API answers with. The cursor of the page
 * after it is the ID of its last item, so a page stays where it is while
 * items are added or removed; pages are only walked forwards.
 */
export const toApiPage = <Item extends { id: string }>(
  data: Item[],
  { total, hasMore }: { total: number; hasMore: boolean },
  { limit, after }: Paging<string>,
): ApiPage<Item> => ({
  data,
  meta: {
    total,
    limit,
    hasMore,
    cursor: after,
    nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
    prevCursor: null,
  },
})
