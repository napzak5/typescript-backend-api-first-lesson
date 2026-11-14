import type { components } from '@beauty-salon-backend/generated'

type PaginationMeta = components['schemas']['Models.PaginationMeta']
type PaginationLinks = components['schemas']['Models.PaginationLinks']

/** Links of a single salon; `collectionPath` is where the salon routes are mounted. */
export const salonLinks = (
  collectionPath: string,
  id: string,
): { self: string; list: string } => ({
  self: `${collectionPath}/${id}`,
  list: collectionPath,
})

const queryOf = (url: string): string => {
  const start = url.indexOf('?')
  return start === -1 ? '' : url.slice(start + 1)
}

/**
 * Links of a page of salons: the request itself with the cursor replaced.
 * Pages are only walked forwards, so there is no `prev` or `last`.
 */
export const salonPageLinks = (
  collectionPath: string,
  requestUrl: string,
  meta: PaginationMeta,
): PaginationLinks => {
  const pageAt = (cursor: string | null): string => {
    const parameters = new URLSearchParams(queryOf(requestUrl))
    parameters.delete('cursor')
    if (cursor !== null) {
      parameters.set('cursor', cursor)
    }
    const query = parameters.toString()
    return query === '' ? collectionPath : `${collectionPath}?${query}`
  }

  return {
    self: pageAt(meta.cursor),
    first: pageAt(null),
    last: null,
    next: meta.nextCursor === null ? null : pageAt(meta.nextCursor),
    prev: null,
  }
}
