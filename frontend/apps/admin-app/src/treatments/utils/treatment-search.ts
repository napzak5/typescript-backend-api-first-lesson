import { isDay } from '@beauty-salon-frontend/fields'
import { daysErrorsOf } from '@beauty-salon-frontend/salon-screens'
import {
  errorsInJapanese,
  type FormRead,
  textOf,
} from '@beauty-salon-frontend/ui'
import * as z from 'zod'
import type { TreatmentConditions } from '../api/treatments-api'

/*
 * Which treatment records the list shows, kept in the query of the
 * address: a reload, the way back from a record and an address that is
 * passed on show the same records.
 */

const idSchema = z.uuid()

/** An ID of the query, if it is one: the API refuses what is not. */
const idIn = (query: URLSearchParams, name: string): string | undefined => {
  const value = query.get(name) ?? ''

  return idSchema.safeParse(value).success ? value.toLowerCase() : undefined
}

/**
 * The conditions in the query of an address. What the API does not take is
 * no condition: an ID that is none, a day that is none, and a last day
 * before the first.
 */
export const treatmentConditionsIn = (
  query: URLSearchParams,
): TreatmentConditions => {
  const staff = idIn(query, 'staff')
  const customer = idIn(query, 'customer')
  const first = query.get('from') ?? ''
  const last = query.get('to') ?? ''
  const from = isDay(first) ? first : undefined
  const to =
    isDay(last) && (from === undefined || last >= from) ? last : undefined

  return {
    ...(staff === undefined ? {} : { staff }),
    ...(customer === undefined ? {} : { customer }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  }
}

/**
 * The conditions that were filled in: each may be left empty. The customer
 * is not a control of the form: it is kept from the address the list was
 * opened at.
 */
export const readTreatmentConditions = (
  values: FormData,
): FormRead<TreatmentConditions> => {
  const staff = textOf(values, 'staff')
  const customer = textOf(values, 'customer')
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
      ...(staff === '' ? {} : { staff }),
      ...(customer === '' ? {} : { customer }),
      ...(from === '' ? {} : { from }),
      ...(to === '' ? {} : { to }),
    },
  }
}

/** The query that keeps conditions in an address: the same conditions are the same address. */
export const treatmentQueryOf = ({
  staff,
  customer,
  from,
  to,
}: TreatmentConditions): URLSearchParams =>
  new URLSearchParams(
    Object.entries({ staff, customer, from, to }).flatMap(([name, value]) =>
      value === undefined ? [] : [[name, value]],
    ),
  )
