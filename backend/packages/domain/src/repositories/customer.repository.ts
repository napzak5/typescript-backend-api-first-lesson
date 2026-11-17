import type { Result } from '@beauty-salon-backend/utility'
import type { UserId } from '../models/auth'
import type {
  CustomerId,
  CustomerProfileWrite,
  DbCustomer,
  DbCustomerChanges,
  DbNewCustomer,
} from '../models/customer'
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
 * Customers named that are not there, or are deleted: the customers to
 * change or delete (`customersNotFound`), or the referrers of those to
 * create or change (`referrersNotFound`).
 */
type Missing<T extends 'customersNotFound' | 'referrersNotFound'> = {
  type: T
  missing: string[]
}

export type CustomerBulkCreation =
  | { type: 'created'; customers: DbCustomer[] }
  | Missing<'referrersNotFound'>

export type CustomerBulkUpdate =
  | { type: 'updated'; customers: DbCustomer[] }
  | Missing<'customersNotFound'>
  | Missing<'referrersNotFound'>

export type CustomerBulkDeletion =
  | { type: 'deleted' }
  | Missing<'customersNotFound'>
  /** The customers that a booking that is not finished refers to. */
  | { type: 'bookingsUnfinished'; customers: string[] }

/** What became of a deleted customer who was to be restored. */
export type CustomerRestoration =
  | { type: 'restored'; customer: DbCustomer }
  /** No customer has the ID, deleted or not. */
  | { type: 'notFound' }
  | { type: 'notDeleted' }

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
   * was the profile of. An email that a customer who is not deleted has
   * taken meanwhile is refused with `alreadyExists`.
   */
  restore(
    id: CustomerId,
    changedBy: UserId,
  ): Promise<Result<CustomerRestoration, DomainError>>

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
