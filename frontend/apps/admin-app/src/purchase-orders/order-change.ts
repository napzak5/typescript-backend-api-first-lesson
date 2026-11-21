import type {
  ModelsPurchaseOrderResponse,
  ModelsPurchaseOrderUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { dayAt, type Read, textOf } from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
} from '../bookings/booking-entry'
import { DAY_ERROR, deliveryOf } from './order-entry'
import type { OrderUpdate } from './purchase-orders-api'

/*
 * How the form that changes the day of the delivery and the notes of an
 * order is read, and what it says when the API did not take it.
 */

/** What the form shows of a text: blank shows as nothing */
const shownText = (text: string | null): string | null =>
  nullIfBlank(text ?? '')

/** The day an order is to be delivered on, as the control of a date holds it: empty when none is set. */
export const deliveryDayOf = (
  expectedDelivery: string | null,
  timezone: string,
): string =>
  expectedDelivery === null ? '' : dayAt(new Date(expectedDelivery), timezone)

/** What the screen says of an order that was delivered or cancelled: the API does not change it any more */
export const CLOSED_ORDERS: Record<'delivered' | 'cancelled', string> = {
  delivered: 'この発注は納品済みです。納品済みの発注は、直せません。',
  cancelled: 'この発注は取り消しました。取り消した発注は、直せません。',
}

/** What the form gives: what was changed, nothing, or what is wrong with a field */
export type OrderChangeRead =
  | Read<ModelsPurchaseOrderUpdateRequest>
  | { type: 'unchanged' }

/**
 * What was changed on the form, and nothing else: a field left as it was
 * opened is not sent, and one made empty clears what the order held.
 */
export const readOrderChange = (
  values: FormData,
  order: Pick<
    ModelsPurchaseOrderResponse,
    'expectedDelivery' | 'deliveryNotes' | 'notes'
  >,
  timezone: string,
): OrderChangeRead => {
  const day = textOf(values, 'expectedDelivery')
  const expectedDelivery = deliveryOf(day, timezone)
  if (expectedDelivery === undefined) {
    return { type: 'invalid', errors: { expectedDelivery: DAY_ERROR } }
  }
  const deliveryNotes = nullIfBlank(textOf(values, 'deliveryNotes'))
  const notes = nullIfBlank(textOf(values, 'notes'))
  const changes: ModelsPurchaseOrderUpdateRequest = {
    ...(day === deliveryDayOf(order.expectedDelivery, timezone)
      ? {}
      : { expectedDelivery }),
    ...(deliveryNotes === shownText(order.deliveryNotes)
      ? {}
      : { deliveryNotes }),
    ...(notes === shownText(order.notes) ? {} : { notes }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', request: changes }
}

/**
 * What the form says after the API did not take it. An order that was
 * delivered or cancelled meanwhile is read anew: the screen then says that
 * it does not change.
 */
export const afterOrderChange = (
  outcome: Extract<
    OrderUpdate,
    { type: 'invalid' | 'forbidden' | 'tooManyRequests' | 'failed' }
  >,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const others = values.filter(({ field }) => field !== 'expectedDelivery')
      const atDay = others.length < values.length

      return {
        message:
          atDay && others.length === 0
            ? undefined
            : '入力した内容を確かめて、もう一度お試しください。',
        errors: atDay ? { expectedDelivery: DAY_ERROR } : {},
      }
    })
    .with({ type: 'forbidden' }, () => ({
      message: 'このアカウントでは、この発注を直せません。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '発注を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
