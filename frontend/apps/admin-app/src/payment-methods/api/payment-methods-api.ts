import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type RefusedValue,
  refusedValuesOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsPaymentMethodCreateRequest,
  type ModelsPaymentMethodResponse,
  type ModelsPaymentMethodUpdateRequest,
  paymentMethodCrudCreate,
  paymentMethodCrudDelete,
  paymentMethodCrudGet,
  paymentMethodCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * The payment methods of a salon: the means it receives payments by.
 * Everybody who works at the salon reads them, since a sale is paid by
 * them; the owner, a manager and an administrator keep them. The list is
 * read with the sales (`readPaymentMethods` in `sales/api/sales-api.ts`).
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether a role keeps the payment methods of its salon: the owner, a manager and an administrator. */
export const mayKeepPaymentMethods = (role: string): boolean =>
  KEEPERS.includes(role)

/** The key a payment method is read under. */
export const paymentMethodKeyOf = (paymentMethodId: string): string[] => [
  'payment-method',
  paymentMethodId,
]

export type PaymentMethodRead =
  | { type: 'found'; method: ModelsPaymentMethodResponse }
  | NotFound
  /** The account works at another salon */
  | Forbidden
  | Unread

/** A payment method of a salon: one of another salon, or none, is not found. */
export const readPaymentMethod = async (
  salonId: string,
  paymentMethodId: string,
): Promise<PaymentMethodRead> => {
  const answer = await paymentMethodCrudGet(salonId, paymentMethodId).catch(
    () => null,
  )

  return match(answer)
    .returnType<PaymentMethodRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', method: data.data }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type PaymentMethodWrite =
  | { type: 'written'; method: ModelsPaymentMethodResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | NotFound
  | Forbidden
  | Unread

/** Adds a payment method to a salon. */
export const addPaymentMethod = async (
  salonId: string,
  request: ModelsPaymentMethodCreateRequest,
): Promise<PaymentMethodWrite> => {
  const answer = await paymentMethodCrudCreate(salonId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<PaymentMethodWrite>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'written',
      method: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** Changes what is given of a payment method, and nothing else. */
export const changePaymentMethod = async (
  salonId: string,
  paymentMethodId: string,
  request: ModelsPaymentMethodUpdateRequest,
): Promise<PaymentMethodWrite> => {
  const answer = await paymentMethodCrudUpdate(
    salonId,
    paymentMethodId,
    request,
  ).catch(() => null)

  return match(answer)
    .returnType<PaymentMethodWrite>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      method: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type PaymentMethodRemoval =
  | { type: 'removed' }
  /** A payment was received by the method: it stays */
  | { type: 'inUse' }
  | NotFound
  | Forbidden
  | Unread

/** Removes a payment method that no payment was received by. */
export const removePaymentMethod = async (
  salonId: string,
  paymentMethodId: string,
): Promise<PaymentMethodRemoval> => {
  const answer = await paymentMethodCrudDelete(salonId, paymentMethodId).catch(
    () => null,
  )

  return match(answer)
    .returnType<PaymentMethodRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 409 }, () => ({ type: 'inUse' }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
