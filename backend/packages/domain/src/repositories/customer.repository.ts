import type { Result } from '@beauty-salon-backend/utility'
import type { ChartList } from '../business-logic/customer/_shared/merge'
import type { DbUser, UserId } from '../models/auth'
import type { BookingWithServices } from '../models/booking'
import type {
  CustomerId,
  CustomerMergeConflictResolution,
  CustomerProfileWrite,
  DbCustomer,
  DbCustomerChanges,
  DbNewCustomer,
} from '../models/customer'
import type { DbCustomerAllergy } from '../models/customer-allergy'
import type { DbCustomerPreferences } from '../models/customer-preferences'
import type { DbCustomerVersion } from '../models/customer-version'
import type { DbMedicalChart } from '../models/medical-chart'
import type { DbPointTransaction } from '../models/point'
import type { DbReview } from '../models/review'
import type { SaleWithDetails } from '../models/sale'
import type { TreatmentRecordWithDetails } from '../models/treatment-record'
import type { DomainError } from '../shared'

/** Which customers a list returns. A null filter does not restrict the list. */
export type CustomerListCriteria = {
  limit: number
  /** Return the customers that follow this one; null starts from the newest. */
  after: CustomerId | null
  /** Text that a name, the reading of a name, or the email contains. */
  search: string | null
  /**
   * Digits that the digits of the phone number contain. It widens `search`:
   * a customer matches when either does.
   */
  phoneDigits: string | null
  /** A customer must have every one of these; an empty list does not filter. */
  tags: string[]
  /** Registered at this time or later. */
  registeredFrom: string | null
  /** Registered at this time or earlier. */
  registeredTo: string | null
  customerStatus: DbCustomer['customerStatus'] | null
  membershipTier: DbCustomer['membershipTier'] | null
}

export type CustomerList = {
  customers: DbCustomer[]
  /** Number of customers that match the filters, across all pages. */
  total: number
  hasMore: boolean
}

/** The filters of the list, without its page: what a CSV export takes. */
export type CustomerFilters = Omit<CustomerListCriteria, 'limit' | 'after'>

/**
 * The customers of a CSV export, read at one moment:
 * - `exported`: every customer who matches, in the order of the list
 * - `tooMany`: more match than may be exported at once, and how many
 */
export type CustomerExport =
  | { type: 'exported'; customers: DbCustomer[] }
  | { type: 'tooMany'; matching: number }

/**
 * Everything held of one customer, read at one moment. Each list is in the
 * order the rows were written, by `createdAt` and then the ID; the versions
 * are in the order of their numbers.
 */
export type CustomerData = {
  customer: DbCustomer
  account: DbUser | null
  preferences: DbCustomerPreferences | null
  medicalChart: DbMedicalChart | null
  allergies: DbCustomerAllergy[]
  bookings: BookingWithServices[]
  sales: SaleWithDetails[]
  pointTransactions: DbPointTransaction[]
  reviews: DbReview[]
  helpfulReviewIds: string[]
  treatmentRecords: TreatmentRecordWithDetails[]
  versions: DbCustomerVersion[]
}

/** The customer named as the referrer does not exist, or is deleted. */
export type CustomerWriteRefusal = { type: 'referrerNotFound' }

export type CustomerCreation =
  | { type: 'created'; customer: DbCustomer }
  | CustomerWriteRefusal

/** What became of a customer that was to be deleted. */
export type CustomerDeletion =
  | { type: 'deleted' }
  /** There is no such customer, or it is deleted already. */
  | { type: 'notFound' }
  /** A booking of the customer, in whatever salon, is not finished. */
  | { type: 'bookingsUnfinished' }

export type CustomerUpdate =
  | { type: 'updated'; customer: DbCustomer }
  | { type: 'notFound' }
  | CustomerWriteRefusal

/** The changes of one customer of a bulk update. */
export type CustomerChange = { id: CustomerId; changes: DbCustomerChanges }

/**
 * The first of the customers to change or delete, in the order given, that
 * is not there or is deleted.
 */
type CustomerMissing = { type: 'customerNotFound'; id: string }

/**
 * The referrers named by the customers to create or change that are not
 * there, or are deleted.
 */
type ReferrersMissing = { type: 'referrersNotFound'; missing: string[] }

export type CustomerBulkCreation =
  | { type: 'created'; customers: DbCustomer[] }
  | ReferrersMissing

export type CustomerBulkUpdate =
  | { type: 'updated'; customers: DbCustomer[] }
  | CustomerMissing
  | ReferrersMissing

export type CustomerBulkDeletion =
  | { type: 'deleted' }
  | CustomerMissing
  /**
   * The first of the customers, in the order given, that a booking that
   * is not finished refers to.
   */
  | { type: 'bookingsUnfinished'; customer: string }

/** What became of a deleted customer who was to be restored. */
export type CustomerRestoration =
  | { type: 'restored'; customer: DbCustomer }
  /** No customer has the ID, deleted or not. */
  | { type: 'notFound' }
  | { type: 'notDeleted' }
  /** A merge deleted the customer, and what they had is the other's. */
  | { type: 'mergedAway' }
  /** The data of the customer was erased at their request. */
  | { type: 'erased' }

/** One of the two customers a merge names, as the request names them. */
export type MergedCustomerField = 'primaryCustomerId' | 'secondaryCustomerId'

/**
 * What a merge is told: the customer that is kept, the one that is merged
 * into it, and whose value is kept where the two differ.
 */
export type CustomerMergeInstruction = {
  primaryCustomerId: CustomerId
  secondaryCustomerId: CustomerId
  conflictResolution: CustomerMergeConflictResolution
}

/**
 * What became of a merge:
 * - `merged`: the primary, as the merge left it
 * - `customersNotFound`: these of the two are not there, or are deleted
 * - `accountsDiffer`: each of the two is the profile of an account
 * - `pointsBeyondLimit`: the points of both are more than a balance holds
 * - `chartTooLong`: the medical charts of both list more in `list` than a
 *   request may write
 * - `deletionRequested`: these of the two have asked for their data to be
 *   erased, and the request is pending
 */
export type CustomerMerge =
  | { type: 'merged'; customer: DbCustomer }
  | { type: 'customersNotFound'; missing: MergedCustomerField[] }
  | { type: 'accountsDiffer' }
  | { type: 'pointsBeyondLimit' }
  | { type: 'chartTooLong'; list: ChartList }
  | { type: 'deletionRequested'; customers: string[] }

/**
 * Why an account did not get a profile:
 * - `notACustomerAccount`: the account is not one with the role `customer`
 * - `alreadyHasProfile`: the account has a customer record
 * - `emailNotVerified`: the account has not confirmed its email address
 * - `entryOfAnotherAccount`: the ledger entry with the account's email
 *   belongs to another account
 */
export type CustomerProfileRefusal = {
  type:
    | 'notACustomerAccount'
    | 'alreadyHasProfile'
    | 'emailNotVerified'
    | 'entryOfAnotherAccount'
}

export type CustomerProfileCreation =
  | { type: 'created'; customer: DbCustomer }
  | CustomerProfileRefusal

/**
 * Persistence of customers. Deleted customers are invisible to every
 * method but `restore`, except that a deleted customer still says where a
 * page of the list begins. An email that a customer who is not deleted
 * has, and a referral code that any customer has or had, are refused with
 * `alreadyExists`.
 *
 * Every write of a customer keeps a version of what the ledger holds of
 * the customer after it (`customer_versions`), in its own transaction:
 * `changedBy` is the user who writes.
 */
export interface ICustomerRepository {
  create(
    customer: DbNewCustomer,
    changedBy: UserId,
  ): Promise<Result<CustomerCreation, DomainError>>

  findById(id: CustomerId): Promise<Result<DbCustomer | null, DomainError>>

  /**
   * Newest first. Resolves to null when the cursor (`after`) names no
   * customer.
   */
  list(
    criteria: CustomerListCriteria,
  ): Promise<Result<CustomerList | null, DomainError>>

  update(
    id: CustomerId,
    changes: DbCustomerChanges,
    changedBy: UserId,
  ): Promise<Result<CustomerUpdate, DomainError>>

  /**
   * Deletes the customer and takes the record from the account that has it
   * as its profile, unless a booking of the customer is not finished.
   */
  delete(
    id: CustomerId,
    changedBy: UserId,
  ): Promise<Result<CustomerDeletion, DomainError>>
  /**
   * Brings a deleted customer back to the ledger, without the account it
   * was the profile of, unless a merge deleted it or its data was erased. An email that a customer who is not deleted has
   * taken meanwhile is refused with `alreadyExists`.
   */
  restore(
    id: CustomerId,
    changedBy: UserId,
  ): Promise<Result<CustomerRestoration, DomainError>>

  /**
   * Merges the secondary into the primary and deletes the secondary, or
   * changes nothing. What either has is the primary's after it: their
   * bookings, sales, treatment records, reviews and helpful marks, the
   * account, the points, the preferences, the medical chart and the
   * allergies, merged as `_shared/merge.ts` decides. Each of the two keeps
   * a version of the merge. A customer with a pending deletion request is
   * not merged: the data it asked to erase would become another's.
   */
  merge(
    instruction: CustomerMergeInstruction,
    changedBy: UserId,
  ): Promise<Result<CustomerMerge, DomainError>>

  /**
   * The customers who match the filters, in the order of the list, unless
   * more than `most` do; then how many do, counted at the moment the
   * customers were read.
   */
  exportMatching(
    filters: CustomerFilters,
    most: number,
  ): Promise<Result<CustomerExport, DomainError>>

  /**
   * Everything held of a customer who is not deleted, read at one moment;
   * null when there is no such customer.
   */
  dataOf(id: CustomerId): Promise<Result<CustomerData | null, DomainError>>

  /** The customers of these IDs that are not deleted, in no given order. */
  findByIds(
    ids: readonly CustomerId[],
  ): Promise<Result<DbCustomer[], DomainError>>

  /**
   * Adds every customer, in the order given, or none: when a referrer is
   * not a customer who is not deleted, or when a write is refused.
   */
  createMany(
    customers: readonly DbNewCustomer[],
    changedBy: UserId,
  ): Promise<Result<CustomerBulkCreation, DomainError>>

  /**
   * Changes every customer, one after the other in the order given, or
   * none. The customers are held until the end, taken in the order of
   * their IDs.
   */
  updateMany(
    changes: readonly CustomerChange[],
    changedBy: UserId,
  ): Promise<Result<CustomerBulkUpdate, DomainError>>

  /**
   * Deletes every customer, as `delete` deletes one, or none. The customers
   * are held until the end, taken in the order of their IDs.
   */
  deleteMany(
    ids: readonly CustomerId[],
    changedBy: UserId,
  ): Promise<Result<CustomerBulkDeletion, DomainError>>

  /**
   * Gives the account a customer record and links the two. The record is
   * the ledger entry that has the account's email, changed by `claim`,
   * unless that entry belongs to another account; when the ledger has no
   * entry with the email, it is `newEntry` with the account's email. The
   * user of the account is the one who writes the version.
   */
  createProfile(
    userId: UserId,
    write: CustomerProfileWrite,
  ): Promise<Result<CustomerProfileCreation, DomainError>>
}
