import type { Result } from '@beauty-salon-backend/utility'
import type { CustomerId } from '../models/customer'
import type {
  CustomerVersionId,
  DbCustomerVersion,
} from '../models/customer-version'
import type { DomainError } from '../shared'

/** Which versions of a customer a page of the history holds. */
export type CustomerVersionListCriteria = {
  customerId: CustomerId
  limit: number
  /** Return the versions before this one (its ID); null starts from the newest. */
  after: CustomerVersionId | null
}

/** A version, and the version before it, which its changes are told against. */
export type CustomerVersionWithPrevious = {
  version: DbCustomerVersion
  /** Null for the first version, and for a version whose predecessor is not kept. */
  previous: DbCustomerVersion | null
}

export type CustomerVersionListing =
  | {
      type: 'listed'
      versions: CustomerVersionWithPrevious[]
      /** Number of versions of the customer, across all pages. */
      total: number
      hasMore: boolean
    }
  /** No customer has the ID, deleted or not. */
  | { type: 'customerNotFound' }
  /** The cursor is not a version of the customer. */
  | { type: 'cursorNotFound' }

export type CustomerVersionLookup =
  | { type: 'found'; version: DbCustomerVersion }
  | { type: 'customerNotFound' }
  | { type: 'versionNotFound' }

/**
 * Reading the versions of customers. A deleted customer keeps its versions,
 * and they are read as those of any customer; only a customer without a row
 * is not found. The versions are written by the customer repository, in the
 * transaction of each write of a customer.
 */
export interface ICustomerVersionRepository {
  /** Newest first. */
  list(
    criteria: CustomerVersionListCriteria,
  ): Promise<Result<CustomerVersionListing, DomainError>>
  find(
    customerId: CustomerId,
    version: number,
  ): Promise<Result<CustomerVersionLookup, DomainError>>
}
