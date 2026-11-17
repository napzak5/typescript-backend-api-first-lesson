import type { OrderStatusType } from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'

/**
 * Where a purchase order stands, and what moves it on. A draft is sent for
 * approval (pending) by an update; the approval, which decides that the
 * money is spent, is an operation of its own; an approved order is placed
 * with the supplier (ordered) and shipped by updates; the receipt of the
 * goods delivers it. An order is cancelled until it is delivered. A
 * delivered or a cancelled order is closed: nothing of it changes again.
 *
 * Each rule is decided on the order as it is once held, so two requests
 * that move one order take turns, and the second is decided on what the
 * first left.
 */

/** Why an order does not take an operation, from where it stands. */
export type OrderStatusRefusal =
  /** The order is delivered or cancelled. */
  | { type: 'closed'; status: OrderStatusType }
  /** The operation does not move an order on from where it stands. */
  | { type: 'notFromStatus'; status: OrderStatusType }

/** Whether nothing of an order changes any more. */
const isClosed = (status: OrderStatusType): boolean =>
  match(status)
    .with('delivered', 'cancelled', () => true)
    .with('draft', 'pending', 'approved', 'ordered', 'shipped', () => false)
    .exhaustive()

/** The status an update moves an order on to from where it stands, if any. */
const nextByUpdate = (status: OrderStatusType): OrderStatusType | null =>
  match(status)
    .returnType<OrderStatusType | null>()
    .with('draft', () => 'pending')
    .with('approved', () => 'ordered')
    .with('ordered', () => 'shipped')
    .with('pending', 'shipped', 'delivered', 'cancelled', () => null)
    .exhaustive()

/**
 * Why an update is refused, null when it is taken. An update writes the
 * status the order has, or the next one of the steps the staff take: the
 * draft sent for approval, the approved order placed, the order shipped.
 * One that writes no status is taken as long as the order is open.
 */
export const refusalOfUpdate = (
  status: OrderStatusType,
  next: OrderStatusType | undefined,
): OrderStatusRefusal | null => {
  if (isClosed(status)) {
    return { type: 'closed', status }
  }

  return next === undefined || next === status || next === nextByUpdate(status)
    ? null
    : { type: 'notFromStatus', status }
}

/** Why an approval is refused, null when it is taken: only a pending order is approved. */
export const refusalOfApproval = (
  status: OrderStatusType,
): OrderStatusRefusal | null =>
  match(status)
    .returnType<OrderStatusRefusal | null>()
    .with('pending', () => null)
    .with('delivered', 'cancelled', () => ({ type: 'closed', status }))
    .with('draft', 'approved', 'ordered', 'shipped', () => ({
      type: 'notFromStatus',
      status,
    }))
    .exhaustive()

/**
 * Why a receipt is refused, null when it is taken: the goods of an order
 * that was placed with the supplier, shipped or not, are received.
 */
export const refusalOfGoodsReceipt = (
  status: OrderStatusType,
): OrderStatusRefusal | null =>
  match(status)
    .returnType<OrderStatusRefusal | null>()
    .with('ordered', 'shipped', () => null)
    .with('delivered', 'cancelled', () => ({ type: 'closed', status }))
    .with('draft', 'pending', 'approved', () => ({
      type: 'notFromStatus',
      status,
    }))
    .exhaustive()

/** Why a cancellation is refused, null when it is taken: an open order is cancelled. */
export const refusalOfCancellation = (
  status: OrderStatusType,
): OrderStatusRefusal | null =>
  isClosed(status) ? { type: 'closed', status } : null
