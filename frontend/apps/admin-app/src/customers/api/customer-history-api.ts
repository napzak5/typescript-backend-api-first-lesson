import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  REFUSED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  customerCrudDelete,
  customerCrudGetHistory,
  customerCrudGetVersion,
  customerCrudRestore,
  type ModelsCustomerHistoryEntryResponse,
  type ModelsCustomerResponse,
  type ModelsCustomerVersionResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { customerKeyOf } from './customers-api'

const idSchema = z.uuid()

/** The largest number a version may have: the largest integer of the database */
const LAST_VERSION = 2_147_483_647

/** The number of a version an address names; `undefined` when no version can have it. */
const numberOfVersion = (version: string): number | undefined =>
  /^[1-9]\d{0,9}$/.test(version) && Number(version) <= LAST_VERSION
    ? Number(version)
    : undefined

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key of the history of a customer, the pages that were read. */
export const historyKeyOf = (customerId: string): string[] => [
  ...customerKeyOf(customerId),
  'history',
]

/** The key of a version of a customer, as an address names it. */
export const versionKeyOf = (customerId: string, version: string): string[] => [
  ...customerKeyOf(customerId),
  'versions',
  version,
]

/** The key of what is known of a customer who is not in the ledger. */
export const removedKeyOf = (customerId: string): string[] => [
  ...customerKeyOf(customerId),
  'removed',
]

/** How many versions a page of the history has. */
const HISTORY_PAGE = 20

/**
 * The versions of a customer, the latest first, a page at a time. The
 * screen reads the customer first: an answer that says nothing of the
 * versions (no customer, no permission) is one that was not read.
 */
export const readHistoryPage = async (
  customerId: string,
  cursor: string | undefined,
): Promise<Page<ModelsCustomerHistoryEntryResponse> | Unread> => {
  const answer = await customerCrudGetHistory(customerId, {
    ...from(cursor),
    limit: HISTORY_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsCustomerHistoryEntryResponse> | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: P.union(403, 404) }, () => FAILED)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type VersionRead =
  | { type: 'found'; version: ModelsCustomerVersionResponse }
  /** No customer has the ID, or the customer has no version of the number */
  | NotFound
  | Forbidden
  | Unread

/**
 * A version of a customer, as the address names it. A number that no
 * version can have is a version that is not found.
 */
export const readVersion = async (
  customerId: string,
  version: string,
): Promise<VersionRead> => {
  const number = numberOfVersion(version)
  if (!idSchema.safeParse(customerId).success || number === undefined) {
    return NOT_FOUND
  }
  const answer = await customerCrudGetVersion(customerId, number).catch(
    () => null,
  )

  return match(answer)
    .returnType<VersionRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      version: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** How a customer left the ledger, as the latest of their versions says it. */
export type Removal = 'deleted' | 'merged' | 'erased'

export type RemovedRead =
  /** The customer is kept, out of the ledger: their latest version, and how they left */
  | {
      type: 'removed'
      version: ModelsCustomerVersionResponse
      removal: Removal
    }
  /** The latest version is no removal: the customer came back in the meantime */
  | { type: 'present' }
  /** No customer has the ID */
  | NotFound
  | Forbidden
  | Unread

/**
 * What is known of a customer the ledger does not show: the ledger does
 * not tell a removed customer from one that never was, but their history
 * is kept, and its latest version holds their values and how they left.
 */
export const readRemoved = async (customerId: string): Promise<RemovedRead> => {
  if (!idSchema.safeParse(customerId).success) {
    return NOT_FOUND
  }
  const answer = await customerCrudGetHistory(customerId, { limit: 1 }).catch(
    () => null,
  )
  const latest = match(answer)
    .returnType<
      | { type: 'latest'; entry: ModelsCustomerHistoryEntryResponse }
      | RemovedRead
    >()
    .with({ status: 200, data: { data: [P.select()] } }, (entry) => ({
      type: 'latest',
      entry,
    }))
    // Every customer has a version: none is a customer that is not there
    .with({ status: 200 }, { status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
  if (latest.type !== 'latest') {
    return latest
  }
  const { entry } = latest
  const removal = match(entry.operation)
    .returnType<Removal | undefined>()
    .with('delete', () => 'deleted')
    .with('merge', () => 'merged')
    .with('erase', () => 'erased')
    .with('baseline', 'create', 'update', 'restore', () => undefined)
    .exhaustive()
  if (removal === undefined) {
    return { type: 'present' }
  }
  const version = await readVersion(customerId, String(entry.version))

  return version.type === 'found'
    ? { type: 'removed', version: version.version, removal }
    : version
}

/** What came of a removal of a customer from the ledger. */
export type CustomerRemoval =
  | { type: 'removed' }
  /** A booking that is not finished is the customer's: they stay */
  | { type: 'unfinished' }
  /** The customer was not in the ledger any more */
  | NotFound
  | Forbidden
  | Unread

/** Takes a customer out of the ledger; the customer is kept, and may come back. */
export const removeCustomer = async (
  customerId: string,
): Promise<CustomerRemoval> => {
  const answer = await customerCrudDelete(customerId).catch(() => null)

  return match(answer)
    .returnType<CustomerRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 409 }, () => ({ type: 'unfinished' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of an attempt to bring a customer back to the ledger. */
export type CustomerRestoration =
  | { type: 'restored'; customer: ModelsCustomerResponse }
  /** Another customer registered since has the address of mail of this one */
  | { type: 'emailTaken' }
  /**
   * The customer is not one to bring back: they came back in the meantime,
   * or left by a merge or an erasure
   */
  | { type: 'unrestorable' }
  | NotFound
  | Forbidden
  | Unread

/** Brings a removed customer back to the ledger. */
export const restoreCustomer = async (
  customerId: string,
): Promise<CustomerRestoration> => {
  const answer = await customerCrudRestore(customerId).catch(() => null)

  return match(answer)
    .returnType<CustomerRestoration>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'restored',
      customer: data.data,
    }))
    .with(
      {
        status: 409,
        data: { type: 'urn:beauty-salon:problem:already-exists' },
      },
      () => ({ type: 'emailTaken' }),
    )
    .with({ status: 409 }, () => ({ type: 'unrestorable' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
