import type { PaymentMethodType } from '@beauty-salon-backend/generated'
import type { Result } from '@beauty-salon-backend/utility'
import type {
  DbNewPaymentMethod,
  DbPaymentMethod,
  DbPaymentMethodChanges,
  PaymentMethodId,
} from '../models/payment-method'
import type { SalonId } from '../models/salon'
import type { DomainError } from '../shared'

/** Which payment methods of a salon a list returns. A null filter does not restrict the list. */
export type PaymentMethodListCriteria = {
  salonId: SalonId
  limit: number
  /** Return the payment methods that follow this one; null starts from the first. */
  after: PaymentMethodId | null
  method: PaymentMethodType | null
  isActive: boolean | null
}

export type PaymentMethodList = {
  paymentMethods: DbPaymentMethod[]
  /** Number of payment methods that match the filters, across all pages. */
  total: number
  hasMore: boolean
}

/** What became of a payment method that was to be changed. */
export type PaymentMethodUpdate =
  | { type: 'updated'; paymentMethod: DbPaymentMethod }
  /** The salon has no such payment method. */
  | { type: 'notFound' }
  /** After the change the lower limit of the amount would be above the upper one. */
  | { type: 'limitsOutOfOrder' }

/** What became of a payment method that was to be deleted. */
export type PaymentMethodRemoval =
  | { type: 'deleted' }
  /** The salon has no such payment method. */
  | { type: 'notFound' }
  /** A payment was taken with it: the payment keeps its payment method. */
  | { type: 'inUse' }

/**
 * Persistence of the payment methods of a salon. Every method is given the
 * salon and sees only its payment methods: a payment method of another
 * salon is one that does not exist. Whether the salon itself exists is not
 * looked at here.
 *
 * A change and a removal hold the payment method while they decide: the
 * limits of a payment method stay in order whatever changes at the same
 * moment, and a payment method that a payment refers to is not removed.
 */
export interface IPaymentMethodRepository {
  create(
    salonId: SalonId,
    paymentMethod: DbNewPaymentMethod,
  ): Promise<Result<DbPaymentMethod, DomainError>>

  findById(
    salonId: SalonId,
    id: PaymentMethodId,
  ): Promise<Result<DbPaymentMethod | null, DomainError>>

  /**
   * In the order of `sortOrder`, then of the IDs. Resolves to null when the
   * cursor (`after`) names no payment method of the salon: a deleted one
   * is gone, and nothing says where the page would begin.
   */
  list(
    criteria: PaymentMethodListCriteria,
  ): Promise<Result<PaymentMethodList | null, DomainError>>

  /**
   * Writes the changes and the time of the change, also when no value
   * differs from what is stored.
   */
  update(
    salonId: SalonId,
    id: PaymentMethodId,
    changes: DbPaymentMethodChanges,
  ): Promise<Result<PaymentMethodUpdate, DomainError>>

  delete(
    salonId: SalonId,
    id: PaymentMethodId,
  ): Promise<Result<PaymentMethodRemoval, DomainError>>
}
