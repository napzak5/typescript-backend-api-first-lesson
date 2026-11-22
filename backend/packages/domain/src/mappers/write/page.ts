import type { Paging } from '../../models/page'

/** How many items a page holds when a request does not say. */
const DEFAULT_LIMIT = 20

/**
 * API request → the place of a page in a list. The cursor of a request is
 * the ID of the last item of the page before; a request without one asks
 * for the start of the list.
 */
export const toPaging = <Id>(request: {
  limit?: number
  cursor?: Id
}): Paging<Id> => ({
  limit: request.limit ?? DEFAULT_LIMIT,
  after: request.cursor ?? null,
})
