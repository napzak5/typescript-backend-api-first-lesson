import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type RefusedValue,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  customerCrudCancelDeletionRequest,
  customerCrudGetDeletionRequest,
  customerCrudRequestDeletion,
  type ModelsCustomerDeletionRequestCreateRequest,
  type ModelsCustomerDeletionRequestResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { customerKeyOf } from './customers-api'

/*
 * The requests of a customer to have the data held of them erased: the
 * latest one, a new one taken, a pending one called off. The erasure
 * itself is run by the operator of the platform.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 400 },
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

export type ErasureRequest = ModelsCustomerDeletionRequestResponse

/** Where the latest request of a customer is kept, below what was read of the customer */
export const erasureKeyOf = (customerId: string): string[] => [
  ...customerKeyOf(customerId),
  'erasure',
]

export type ErasureRead =
  /** The latest request, whatever its state; `null` when the customer never asked */
  { type: 'read'; request: ErasureRequest | null } | Forbidden | Unread

/**
 * The latest request of the customer (`GET /customers/{id}/deletion-request`),
 * of one who was removed or erased as well. The customer is one the page
 * shows, whose row the ledger keeps: a 404 says that they never asked.
 */
export const readErasureRequest = async (
  customerId: string,
): Promise<ErasureRead> => {
  const answer = await customerCrudGetDeletionRequest(customerId).catch(
    () => null,
  )

  return match(answer)
    .returnType<ErasureRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'read',
      request: data.data,
    }))
    .with({ status: 404 }, () => ({ type: 'read', request: null }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ErasureAsking =
  | { type: 'asked'; request: ErasureRequest }
  | { type: 'invalid'; values: RefusedValue[] }
  /** Another request of the customer was pending already */
  | { type: 'pending' }
  /** The customer left the ledger meanwhile */
  | NotFound
  | Forbidden
  | Unread

/**
 * Takes the request of the customer to have their data erased
 * (`POST /customers/{id}/deletion-request`), to be run 14 days later.
 */
export const askForErasure = async (
  customerId: string,
  request: ModelsCustomerDeletionRequestCreateRequest,
): Promise<ErasureAsking> => {
  const answer = await customerCrudRequestDeletion(customerId, request).catch(
    () => null,
  )

  return (
    match(answer)
      .returnType<ErasureAsking>()
      .with({ status: 202 }, ({ data }) => ({
        type: 'asked',
        request: data.data,
      }))
      .with({ status: 400 }, ({ data }) => ({
        type: 'invalid',
        values: refusedValuesOf(data),
      }))
      .with({ status: 409 }, () => ({ type: 'pending' }))
      .with({ status: 404 }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      // The body is the JSON of a reason
      .with({ status: P.union(413, 415) }, () => FAILED)
      .with(
        P.union(null, { status: 401 }, { status: 429 }, { status: 500 }),
        unreadOf,
      )
      .exhaustive(outsideTheContract)
  )
}

export type ErasureCancelling =
  | { type: 'cancelled'; request: ErasureRequest }
  /** No request of the customer is pending: called off, or run, meanwhile */
  | NotFound
  | Forbidden
  | Unread

/**
 * Calls off the pending request of the customer
 * (`DELETE /customers/{id}/deletion-request`): nothing of theirs is erased.
 */
export const cancelErasureRequest = async (
  customerId: string,
): Promise<ErasureCancelling> => {
  const answer = await customerCrudCancelDeletionRequest(customerId).catch(
    () => null,
  )

  return match(answer)
    .returnType<ErasureCancelling>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'cancelled',
      request: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
