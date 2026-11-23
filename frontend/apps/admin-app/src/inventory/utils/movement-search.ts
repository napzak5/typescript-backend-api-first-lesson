import type {
  InventoryCrudListMovementsParams,
  ModelsInventoryTransactionType,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import {
  dayAfter,
  daysErrorsOf,
  startOfDayAt,
} from '@beauty-salon-frontend/salon-screens'
import {
  errorsInJapanese,
  type FormRead,
  textOf,
} from '@beauty-salon-frontend/ui'
import { movementTypeIn } from './movement-format'

/*
 * Which movements of a stock row the history shows, kept in the query of
 * the address: a reload, the way back and an address that is passed on
 * show the same movements.
 */

export type MovementConditions = {
  type?: ModelsInventoryTransactionType
  /** The first day of the movements, at the salon */
  from?: string
  /** The last day of the movements, at the salon */
  to?: string
}

/**
 * The conditions in the query of an address. What the API does not take is
 * no condition: a kind that is none, a day that is none, and a last day
 * before the first.
 */
export const movementConditionsIn = (
  query: URLSearchParams,
): MovementConditions => {
  const type = movementTypeIn(query.get('type') ?? '')
  const first = query.get('from') ?? ''
  const last = query.get('to') ?? ''
  const from = isDay(first) ? first : undefined
  const to =
    isDay(last) && (from === undefined || last >= from) ? last : undefined

  return {
    ...(type === undefined ? {} : { type }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  }
}

/** The conditions that were filled in: each may be left empty. */
export const readMovementConditions = (
  values: FormData,
): FormRead<MovementConditions> => {
  const type = movementTypeIn(textOf(values, 'type'))
  const from = textOf(values, 'from')
  const to = textOf(values, 'to')
  const errors = {
    ...errorsInJapanese(daysErrorsOf(from, to, 'optional')),
  }
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      ...(type === undefined ? {} : { type }),
      ...(from === '' ? {} : { from }),
      ...(to === '' ? {} : { to }),
    },
  }
}

/** The query that keeps conditions in an address: the same conditions are the same address. */
export const movementQueryOf = ({
  type,
  from,
  to,
}: MovementConditions): URLSearchParams =>
  new URLSearchParams(
    Object.entries({ type, from, to }).flatMap(([name, value]) =>
      value === undefined ? [] : [[name, value]],
    ),
  )

/** Whether the conditions narrow the history. */
export const isNarrowedHistory = (conditions: MovementConditions): boolean =>
  Object.keys(conditions).length > 0

/**
 * What the API is asked for: the days at the salon as the moments they
 * begin and end. The end of a day is the moment before the next one begins.
 */
export const movementParamsOf = (
  { type, from: first, to: last }: MovementConditions,
  timezone: string,
): Omit<InventoryCrudListMovementsParams, 'cursor' | 'limit'> => {
  const startDate =
    first === undefined ? undefined : startOfDayAt(first, timezone)
  const nextDay =
    last === undefined ? undefined : startOfDayAt(dayAfter(last, 1), timezone)

  return {
    ...(type === undefined ? {} : { transactionType: type }),
    ...(startDate === undefined ? {} : { startDate }),
    ...(nextDay === undefined
      ? {}
      : { endDate: new Date(Date.parse(nextDay) - 1).toISOString() }),
  }
}
