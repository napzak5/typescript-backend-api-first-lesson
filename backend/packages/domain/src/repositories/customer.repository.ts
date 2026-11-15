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
 * method, except that a deleted customer still says where a page of the
 * list begins. An email that a customer who is not deleted has, and a
 * referral code that any customer has or had, are refused with
 * `alreadyExists`.
 */
export interface ICustomerRepository {
  create(
    customer: DbNewCustomer,
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
  ): Promise<Result<CustomerUpdate, DomainError>>

  /**
   * Deletes the customer and takes the record from the account that has it
   * as its profile, unless a booking of the customer is not finished.
   */
  delete(id: CustomerId): Promise<Result<CustomerDeletion, DomainError>>

  /**
   * Gives the account a customer record and links the two. The record is
   * the ledger entry that has the account's email, changed by `claim`,
   * unless that entry belongs to another account; when the ledger has no
   * entry with the email, it is `newEntry` with the account's email.
   */
  createProfile(
    userId: UserId,
    write: CustomerProfileWrite,
  ): Promise<Result<CustomerProfileCreation, DomainError>>
}
