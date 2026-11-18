import type { Result } from '@beauty-salon-backend/utility'
import type { UserId } from '../models/auth'
import type { CustomerId } from '../models/customer'
import type { DbCustomerDeletionRequest } from '../models/customer-deletion-request'
import type { DomainError } from '../shared'

/**
 * What became of a request to erase the data of a customer:
 * - `requested`: the request taken
 * - `customerNotFound`: no customer who is not deleted has the ID
 * - `alreadyRequested`: the customer has a pending request, this one
 */
export type CustomerDeletionRequesting =
  | { type: 'requested'; request: DbCustomerDeletionRequest }
  | { type: 'customerNotFound' }
  | { type: 'alreadyRequested'; request: DbCustomerDeletionRequest }

/**
 * The latest request of a customer:
 * - `found`: the request taken last, whatever became of it
 * - `customerNotFound`: no customer has the ID, deleted or not
 * - `noRequest`: the customer has no request
 */
export type CustomerDeletionRequestReading =
  | { type: 'found'; request: DbCustomerDeletionRequest }
  | { type: 'customerNotFound' }
  | { type: 'noRequest' }

/**
 * What became of the cancelling of the pending request of a customer:
 * - `cancelled`: the request, cancelled
 * - `customerNotFound`: no customer has the ID, deleted or not
 * - `noPendingRequest`: the customer has no pending request
 */
export type CustomerDeletionRequestCancelling =
  | { type: 'cancelled'; request: DbCustomerDeletionRequest }
  | { type: 'customerNotFound' }
  | { type: 'noPendingRequest' }

/**
 * What became of a request that was due when it was looked for:
 * - `erased`: the data of its customer is erased, and the request is done
 * - `notDue`: by the time it was held, it was cancelled or done already
 */
export type CustomerErasure =
  | { type: 'erased'; request: DbCustomerDeletionRequest }
  | { type: 'notDue' }

/**
 * Persistence of the requests to erase the data of a customer, and the
 * erasure. A request, the cancelling of one and an erasure each hold the
 * customer first, so one customer has at most one pending request, and a
 * request is cancelled or carried out once.
 */
export interface ICustomerDeletionRequestRepository {
  /**
   * Takes a request of the customer, due the grace period after it is
   * taken, unless the customer is deleted or has a pending request.
   */
  request(
    customerId: CustomerId,
    reason: string,
    requestedBy: UserId,
  ): Promise<Result<CustomerDeletionRequesting, DomainError>>

  /** The request of the customer taken last, of a deleted customer too. */
  latestOf(
    customerId: CustomerId,
  ): Promise<Result<CustomerDeletionRequestReading, DomainError>>

  /** Cancels the pending request of the customer, of a deleted customer too. */
  cancel(
    customerId: CustomerId,
    cancelledBy: UserId,
  ): Promise<Result<CustomerDeletionRequestCancelling, DomainError>>

  /**
   * The IDs of the pending requests that are due, in the order they fell
   * due. No request is named by a request of a user, so the IDs are those
   * the database gave.
   */
  dueRequests(): Promise<Result<DbCustomerDeletionRequest['id'][], DomainError>>

  /**
   * Erases the data of the customer of the request, as
   * `customer-deletion-request/_shared/erasure.ts` decides, and records that
   * the request is done, in one transaction, if the request is still
   * pending and due; otherwise changes nothing.
   */
  erase(
    id: DbCustomerDeletionRequest['id'],
    completedBy: UserId,
  ): Promise<Result<CustomerErasure, DomainError>>
}
