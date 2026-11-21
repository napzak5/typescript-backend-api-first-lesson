import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/salon-screens'
import * as z from 'zod/mini'

/**
 * Which bookings of a salon the list shows: those of one day, and of a
 * state and a member of the staff if they are named. The names are those
 * of the query of the address the list is kept in.
 */
export type DayConditions = {
  /** The day at the salon */
  date: string
  status?: ModelsBookingStatusType
  staffId?: string
}

/** The states a booking can be in, in the order a day goes */
export const STATUSES: readonly ModelsBookingStatusType[] = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'draft',
]

const idSchema = z.uuid()

const statusFrom = (
  value: string | null,
): ModelsBookingStatusType | undefined =>
  STATUSES.find((status) => status === value)

const staffIdFrom = (value: string | null): string | undefined =>
  value !== null && idSchema.safeParse(value).success ? value : undefined

/**
 * Reads conditions from where they are written. What the API does not
 * take is no condition: no day is today at the salon, and a state or a
 * member that is not one narrows nothing. An address that somebody
 * changed by hand shows what is left of it.
 */
const conditionsFrom = (
  read: (name: keyof DayConditions) => string | null,
  today: string,
): DayConditions => {
  const date = read('date') ?? ''
  const status = statusFrom(read('status'))
  const staffId = staffIdFrom(read('staffId'))

  return {
    date: isDay(date) ? date : today,
    ...(status === undefined ? {} : { status }),
    ...(staffId === undefined ? {} : { staffId }),
  }
}

/** The conditions in the query of an address. */
export const conditionsIn = (
  query: URLSearchParams,
  today: string,
): DayConditions => conditionsFrom((name) => query.get(name), today)

/** The conditions that were filled in. */
export const conditionsOf = (values: FormData, today: string): DayConditions =>
  conditionsFrom((name) => {
    const value = values.get(name)

    return typeof value === 'string' ? value : null
  }, today)

/**
 * The query that keeps conditions in an address: the same conditions are
 * the same address, whatever order they were filled in.
 */
export const queryOf = (conditions: DayConditions): URLSearchParams =>
  new URLSearchParams(
    Object.entries({
      date: conditions.date,
      status: conditions.status,
      staffId: conditions.staffId,
    }).flatMap(([name, value]) => (value === undefined ? [] : [[name, value]])),
  )

/** Whether the list leaves some bookings of the day out. */
export const narrows = (conditions: DayConditions): boolean =>
  conditions.status !== undefined || conditions.staffId !== undefined

/** The same conditions on another day. */
export const onDay = (
  conditions: DayConditions,
  date: string,
): DayConditions => ({ ...conditions, date })

/** The conditions of the whole day: every state, every member. */
export const wholeDay = ({ date }: DayConditions): DayConditions => ({ date })
