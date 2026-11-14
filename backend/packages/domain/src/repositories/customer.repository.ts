import type { Result } from '@beauty-salon-backend/utility'
import type {
  CustomerId,
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

export type CustomerUpdate =
  | { type: 'updated'; customer: DbCustomer }
  | { type: 'notFound' }
  | CustomerWriteRefusal

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

  /** Resolves to false when the customer does not exist. */
  delete(id: CustomerId): Promise<Result<boolean, DomainError>>
}
