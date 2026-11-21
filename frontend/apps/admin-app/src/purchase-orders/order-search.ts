import type { ModelsOrderStatusType } from '@beauty-salon-frontend/api-client'
import {
  dayAfter,
  isDay,
  startOfDayAt,
} from '@beauty-salon-frontend/salon-screens'
import { type Read, textOf } from '../bookings/booking-actions'
import { nullIfBlank } from '../bookings/booking-entry'
import { orderStatusIn } from './order-format'
import type { OrderListParams } from './purchase-orders-api'

/*
 * Which purchase orders the list shows, kept in the query of the address:
 * a reload, the way back from an order and an address that is passed on
 * show the same orders.
 */

export type OrderConditions = {
  status?: ModelsOrderStatusType
  /** The name of the supplier, as the order spells it */
  supplier?: string
  /** The first day the orders were made on, at the salon */
  from?: string
  /** The last day the orders were made on, at the salon */
  to?: string
}

/** The longest name of a supplier, as the API takes it */
const LONGEST_SUPPLIER = 255

/** A name of a supplier the API takes: none for a blank one or one too long. */
const supplierIn = (text: string): string | undefined => {
  const supplier = nullIfBlank(text)

  return supplier === null || [...supplier].length > LONGEST_SUPPLIER
    ? undefined
    : supplier
}

/**
 * The conditions in the query of an address. What the API does not take is
 * no condition: a status, a name or a day that is none, and a last day
 * before the first.
 */
export const orderConditionsIn = (query: URLSearchParams): OrderConditions => {
  const status = orderStatusIn(query.get('status') ?? '')
  const supplier = supplierIn(query.get('supplier') ?? '')
  const first = query.get('from') ?? ''
  const last = query.get('to') ?? ''
  const from = isDay(first) ? first : undefined
  const to =
    isDay(last) && (from === undefined || last >= from) ? last : undefined

  return {
    ...(status === undefined ? {} : { status }),
    ...(supplier === undefined ? {} : { supplier }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  }
}

const SUPPLIER_ERROR = `仕入先は ${LONGEST_SUPPLIER} 文字以内で入力してください。`

const DAY_ERROR = '日付を入力してください。'

const RANGE_ERROR = '終わりの日は、始まりの日と同じか、その後にしてください。'

/** The conditions that were filled in: each may be left empty. */
export const readOrderConditions = (
  values: FormData,
): Read<OrderConditions> => {
  const status = orderStatusIn(textOf(values, 'status'))
  const supplier = nullIfBlank(textOf(values, 'supplier'))
  const from = textOf(values, 'from')
  const to = textOf(values, 'to')
  const errors = {
    ...(supplier === null || supplierIn(supplier) !== undefined
      ? {}
      : { supplier: SUPPLIER_ERROR }),
    ...(from === '' || isDay(from) ? {} : { from: DAY_ERROR }),
    ...(to === '' || isDay(to) ? {} : { to: DAY_ERROR }),
  }
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  if (from !== '' && to !== '' && to < from) {
    return { type: 'invalid', errors: { to: RANGE_ERROR } }
  }

  return {
    type: 'valid',
    request: {
      ...(status === undefined ? {} : { status }),
      ...(supplier === null ? {} : { supplier }),
      ...(from === '' ? {} : { from }),
      ...(to === '' ? {} : { to }),
    },
  }
}

/** The query that keeps conditions in an address: the same conditions are the same address. */
export const orderQueryOf = ({
  status,
  supplier,
  from,
  to,
}: OrderConditions): URLSearchParams =>
  new URLSearchParams(
    Object.entries({ status, supplier, from, to }).flatMap(([name, value]) =>
      value === undefined ? [] : [[name, value]],
    ),
  )

/**
 * What the API is asked for: the orders of the salon, and the days at the
 * salon as the moments they begin and end. The end of a day is the moment
 * before the next one begins.
 */
export const orderListParamsOf = (
  salonId: string,
  { status, supplier, from: first, to: last }: OrderConditions,
  timezone: string,
): OrderListParams => {
  const startDate =
    first === undefined ? undefined : startOfDayAt(first, timezone)
  const nextDay =
    last === undefined ? undefined : startOfDayAt(dayAfter(last, 1), timezone)

  return {
    salonId,
    ...(status === undefined ? {} : { status }),
    ...(supplier === undefined ? {} : { supplier }),
    ...(startDate === undefined ? {} : { startDate }),
    ...(nextDay === undefined
      ? {}
      : { endDate: new Date(Date.parse(nextDay) - 1).toISOString() }),
  }
}
