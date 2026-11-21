import {
  FAILED,
  type Forbidden,
  outsideTheContract,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  customerCrudBulkCreate,
  customerCrudBulkDelete,
  customerCrudBulkUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import {
  type RemovalAttempt,
  type RetagAttempt,
  retaggingOf,
  type TagChange,
} from './customer-bulk'
import type { FileCustomer, RegistrationAttempt } from './customer-file'
import { readCustomers } from './customers-api'

/*
 * The writes of many customers at once: those of a file registered, and
 * those chosen in the ledger given a tag, or removed. The API does all of
 * a write or none of it.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** Registers the customers of a file (`POST /customers/bulk`). */
export const registerCustomers = async (
  customers: readonly FileCustomer[],
): Promise<RegistrationAttempt> => {
  const answer = await customerCrudBulkCreate({
    items: customers.map(({ request }) => request),
  }).catch(() => null)

  return (
    match(answer)
      .returnType<RegistrationAttempt>()
      .with({ status: 201 }, ({ data }) => ({
        type: 'registered',
        count: data.data.created.length,
      }))
      .with({ status: 400 }, ({ data }) => ({
        type: 'invalid',
        values: refusedValuesOf(data),
      }))
      // The API names the value another customer has
      .with({ status: 409 }, ({ data }) => ({
        type: 'conflict',
        detail: data.detail ?? '',
      }))
      .with({ status: 403 }, () => FORBIDDEN)
      .with({ status: 413 }, () => ({ type: 'tooLarge' }))
      .with({ status: 415 }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/**
 * The chosen customers who are no longer in the ledger, read anew: the
 * API names only the first of them, in a sentence.
 */
const goneOf = async (
  ids: readonly string[],
): Promise<{ type: 'gone'; ids: string[] } | Unread> => {
  const read = await readCustomers(ids)
  if (read.type !== 'found') {
    return read
  }
  const gone = ids.filter((id) => !read.customers.has(id))

  return gone.length === 0 ? FAILED : { type: 'gone', ids: gone }
}

/**
 * Gives a tag to the chosen customers, or takes it from them: they are
 * read anew (`POST /customers/batch/get`), and only those whose tags
 * change are sent (`PATCH /customers/bulk`), each with the tags they
 * have now, so that a tag given meanwhile is kept.
 */
export const retagCustomers = async (
  ids: readonly string[],
  change: TagChange,
): Promise<RetagAttempt> => {
  const read = await readCustomers(ids)
  if (read.type !== 'found') {
    return read
  }
  const gone = ids.filter((id) => !read.customers.has(id))
  if (gone.length > 0) {
    return { type: 'gone', ids: gone }
  }
  const items = retaggingOf([...read.customers.values()], change)
  if (items.length === 0) {
    return { type: 'unchanged' }
  }
  const answer = await customerCrudBulkUpdate({ items }).catch(() => null)

  return (
    match(answer)
      .returnType<RetagAttempt | Promise<RetagAttempt>>()
      .with({ status: 200 }, ({ data }) => ({
        type: 'retagged',
        count: data.data.updated.length,
      }))
      // Removed after they were read
      .with({ status: 404 }, () => goneOf(ids))
      .with({ status: 403 }, () => FORBIDDEN)
      // Only the tags are sent, as they were read: the API has nothing else to refuse
      .with({ status: P.union(400, 409, 413, 415) }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/**
 * Removes the chosen customers from the ledger (`DELETE /customers/bulk`).
 * When a customer has bookings that are not finished, the API names the
 * first of them in a sentence: the one of the chosen whose ID it holds.
 */
export const removeCustomers = async (
  ids: readonly string[],
): Promise<RemovalAttempt> => {
  const answer = await customerCrudBulkDelete({ ids: [...ids] }).catch(
    () => null,
  )

  return match(answer)
    .returnType<RemovalAttempt | Promise<RemovalAttempt>>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'removed',
      count: data.data.deleted.length,
    }))
    .with({ status: 409 }, ({ data }) => ({
      type: 'unfinished',
      id: ids.find((id) => (data.detail ?? '').toLowerCase().includes(id)),
    }))
    .with({ status: 404 }, () => goneOf(ids))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(400, 413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
