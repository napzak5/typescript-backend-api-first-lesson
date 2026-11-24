import {
  CHECK_THE_VALUES_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsPurchaseOrderResponse,
  ModelsPurchaseOrderUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { dayAt } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { OrderUpdate } from '../api/purchase-orders-api'
import { DAY_ERROR, deliveryOf } from './order-entry'

const CHANGE = adminPurchaseOrderMessages.form.change

/*
 * How the form that changes the day of the delivery and the notes of an
 * order is read, and what it says when the API did not take it.
 */
/** The day an order is to be delivered on, as the control of a date holds it: empty when none is set. */
export const deliveryDayOf = (
  expectedDelivery: string | null,
  timezone: string,
): string =>
  expectedDelivery === null ? '' : dayAt(new Date(expectedDelivery), timezone)

/** What the screen says of an order that was delivered or cancelled: the API does not change it any more */
export const CLOSED_ORDERS: Record<'delivered' | 'cancelled', LocalizedText> =
  CHANGE.closed

/** What the form gives: what was changed, nothing, or what is wrong with a field */
export type OrderChangeRead =
  | FormRead<ModelsPurchaseOrderUpdateRequest, FormErrors<LocalizedText>>
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
  const deliveryNotes = textOrNull(textOf(values, 'deliveryNotes'))
  const notes = textOrNull(textOf(values, 'notes'))
  const changes: ModelsPurchaseOrderUpdateRequest = {
    ...(day === deliveryDayOf(order.expectedDelivery, timezone)
      ? {}
      : { expectedDelivery }),
    ...(deliveryNotes === textOrNull(order.deliveryNotes)
      ? {}
      : { deliveryNotes }),
    ...(notes === textOrNull(order.notes) ? {} : { notes }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
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
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const others = values.filter(({ field }) => field !== 'expectedDelivery')
      const atDay = others.length < values.length

      return {
        message:
          atDay && others.length === 0 ? undefined : CHECK_THE_VALUES_MESSAGE,
        errors: atDay ? { expectedDelivery: DAY_ERROR } : {},
      }
    })
    .with({ type: 'forbidden' }, () => aboutTheAttempt(CHANGE.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(CHANGE.failed))
    .exhaustive()
