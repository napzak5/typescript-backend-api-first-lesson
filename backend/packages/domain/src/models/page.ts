import type { components } from '@beauty-salon-backend/generated'

// API types, generated from TypeSpec
export type ApiPaginationMeta = components['schemas']['Models.PaginationMeta']

/** A page of a list, as the API presents it: its items, and where the list goes on. */
export type ApiPage<Item> = {
  data: Item[]
  meta: ApiPaginationMeta
}

/**
 * Where a page of a list starts and how many items it holds at most: after
 * the item of this ID, or at the start of the list (`null`).
 */
export type Paging<Id> = {
  limit: number
  after: Id | null
}
