import type { ModelsPaymentStatusType } from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import { dayNameOf, daysErrorsOf } from '@beauty-salon-frontend/salon-screens'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'

/**
 * Which sales of a salon the ledger shows: those whose day (at the salon)
 * is in a range, and of a state of payment if one is named. The names are
 * those of the query of the address the ledger is kept in.
 */
export type LedgerConditions = {
  /** The first day, at the salon */
  from: string
  /** The last day, at the salon; not before the first */
  to: string
  paymentStatus?: ModelsPaymentStatusType
}

/** The states of payment the API writes, in the order a sale goes through them */
export const PAYMENT_STATUSES: readonly ModelsPaymentStatusType[] = [
  'pending',
  'processing',
  'completed',
  'partial_refund',
  'refunded',
]

const paymentStatusFrom = (
  value: string | null,
): ModelsPaymentStatusType | undefined =>
  PAYMENT_STATUSES.find((status) => status === value)

/**
 * The conditions in the query of an address. What the API does not take is
 * no condition: a day that is not one is today, a range whose end comes
 * before its start is the day of its start, and a state that is not one
 * narrows nothing. An address that somebody changed by hand shows what is
 * left of it.
 */
export const ledgerConditionsIn = (
  query: URLSearchParams,
  today: string,
): LedgerConditions => {
  const first = query.get('from') ?? ''
  const last = query.get('to') ?? ''
  const from = isDay(first) ? first : today
  const to = isDay(last) && last >= from ? last : from
  const paymentStatus = paymentStatusFrom(query.get('paymentStatus'))

  return {
    from,
    to,
    ...(paymentStatus === undefined ? {} : { paymentStatus }),
  }
}

/** The conditions that were filled in: both days, the end not before the start. */
export const readLedgerConditions = (
  values: FormData,
): FormRead<LedgerConditions> => {
  const from = textOf(values, 'from')
  const to = textOf(values, 'to')
  const paymentStatus = paymentStatusFrom(textOf(values, 'paymentStatus'))
  const errors = daysErrorsOf(from, to, 'required')
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      from,
      to,
      ...(paymentStatus === undefined ? {} : { paymentStatus }),
    },
  }
}

/**
 * The query that keeps conditions in an address: the same conditions are
 * the same address, whatever order they were filled in.
 */
export const ledgerQueryOf = (conditions: LedgerConditions): URLSearchParams =>
  new URLSearchParams(
    Object.entries({
      from: conditions.from,
      to: conditions.to,
      paymentStatus: conditions.paymentStatus,
    }).flatMap(([name, value]) => (value === undefined ? [] : [[name, value]])),
  )

/** The days of a range, in words: one day, or from one to another. */
export const rangeNameOf = ({ from, to }: LedgerConditions): string =>
  from === to ? dayNameOf(from) : `${dayNameOf(from)}〜${dayNameOf(to)}`
