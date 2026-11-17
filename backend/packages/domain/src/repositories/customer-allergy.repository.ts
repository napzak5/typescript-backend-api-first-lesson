import type { Result } from '@beauty-salon-backend/utility'
import type { CustomerId } from '../models/customer'
import type {
  CustomerAllergyId,
  DbCustomerAllergy,
  DbCustomerAllergyChanges,
  DbNewCustomerAllergy,
} from '../models/customer-allergy'
import type { DomainError } from '../shared'

/** What became of an allergy that was to be added. */
export type CustomerAllergyAddition =
  | { type: 'added'; allergy: DbCustomerAllergy }
  /** No customer of that ID, or one that was deleted. */
  | { type: 'customerNotFound' }
  /** The customer has an allergy of that allergen already. */
  | { type: 'allergenExists' }

/** What became of an allergy that was to be changed. */
export type CustomerAllergyChange =
  | { type: 'changed'; allergy: DbCustomerAllergy }
  /** No customer of that ID, or one that was deleted. */
  | { type: 'customerNotFound' }
  /** The customer is there and has no allergy of that ID. */
  | { type: 'allergyNotFound' }
  /** Another allergy of the customer has the allergen of the change. */
  | { type: 'allergenExists' }

/** What became of an allergy that was to be removed. */
export type CustomerAllergyRemoval =
  | { type: 'removed' }
  /** No customer of that ID, or one that was deleted. */
  | { type: 'customerNotFound' }
  /** The customer is there and has no allergy of that ID. */
  | { type: 'allergyNotFound' }

/** Which allergies of a customer a list returns. */
export type CustomerAllergyListCriteria = {
  customerId: CustomerId
  limit: number
  /** Return the allergies that follow this one; null starts from the first. */
  after: CustomerAllergyId | null
}

/** What a list of the allergies of a customer found. */
export type CustomerAllergyListing =
  | {
      type: 'listed'
      allergies: DbCustomerAllergy[]
      /** Number of allergies of the customer, across all pages. */
      total: number
      hasMore: boolean
    }
  /** No customer of that ID, or one that was deleted. */
  | { type: 'customerNotFound' }
  /** The cursor names no allergy of the customer. */
  | { type: 'cursorNotFound' }

export interface ICustomerAllergyRepository {
  /** Writes an allergy of a customer who is there. */
  add(
    customerId: CustomerId,
    allergy: DbNewCustomerAllergy,
  ): Promise<Result<CustomerAllergyAddition, DomainError>>

  /** Writes the columns the changes name, and the time of the change. */
  update(
    customerId: CustomerId,
    id: CustomerAllergyId,
    changes: DbCustomerAllergyChanges,
  ): Promise<Result<CustomerAllergyChange, DomainError>>

  remove(
    customerId: CustomerId,
    id: CustomerAllergyId,
  ): Promise<Result<CustomerAllergyRemoval, DomainError>>

  /**
   * The allergies of a customer, severest first, then in the order they
   * were recorded (their creation, then their IDs).
   */
  list(
    criteria: CustomerAllergyListCriteria,
  ): Promise<Result<CustomerAllergyListing, DomainError>>
}
