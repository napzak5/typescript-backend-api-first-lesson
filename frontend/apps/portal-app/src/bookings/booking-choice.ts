import type {
  ModelsAvailableSlotResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffLevelType,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import * as z from 'zod/mini'
import { timeOfDayAt } from '../salons/salon-format'

/**
 * What the address of the booking screen says besides the service: with
 * whom, and on which day.
 */
export type Choice = {
  /** `undefined`: with whoever is free */
  staffId: string | undefined
  /** The calendar date at the salon: `2026-11-23` */
  date: string
}

/**
 * Whether a customer can book the service themselves. The API returns no
 * time for a service that cannot, so the screen says so instead of offering
 * days without a time.
 */
export const isBookable = (
  salon: Pick<ModelsSalonResponse, 'isActive'>,
  service: Pick<
    ModelsServiceResponse,
    'isActive' | 'serviceStatus' | 'allowOnlineBooking'
  >,
): boolean =>
  salon.isActive &&
  service.isActive &&
  service.serviceStatus === 'active' &&
  service.allowOnlineBooking

/** The levels of the staff, from the first to the highest */
const RANKS: Record<ModelsStaffLevelType, number> = {
  junior: 0,
  stylist: 1,
  senior: 2,
  expert: 3,
  director: 4,
}

/**
 * The members of the staff a customer may ask for: those who take bookings
 * and have the level the service asks for. The API has times for nobody
 * else. They are in the order of their names: the API lists them by their
 * IDs, which is no order to somebody who looks for a name.
 */
export const staffFor = (
  service: Pick<ModelsServiceResponse, 'requiredStaffLevel'>,
  staff: readonly ModelsStaffProfileResponse[],
): ModelsStaffProfileResponse[] =>
  staff
    .filter(
      (member) =>
        member.canReceiveBookings &&
        (service.requiredStaffLevel === null ||
          RANKS[member.level] >= RANKS[service.requiredStaffLevel]),
    )
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName, 'ja'))

const dateSchema = z.iso.date()

const MS_OF_A_DAY = 24 * 60 * 60 * 1000

/** The calendar date a number of days after a date; before it, for a negative number. */
const daysFrom = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_OF_A_DAY)
    .toISOString()
    .slice(0, 10)

export const dayAfter = (date: string): string => daysFrom(date, 1)

/** The day before a date, and never one before today: a day that has passed has no times. */
export const dayBefore = (date: string, today: string): string => {
  const before = daysFrom(date, -1)

  return before < today ? today : before
}

/**
 * The choice an address names. An address is also typed by hand, and kept
 * until another day: a date that is none or has passed is today, and a
 * member of the staff who cannot be asked for is nobody in particular.
 */
export const choiceIn = (
  query: URLSearchParams,
  today: string,
  staff: readonly Pick<ModelsStaffProfileResponse, 'id'>[],
): Choice => {
  const date = query.get('date') ?? ''
  const staffId = query.get('staffId')

  return {
    staffId: staff.find((member) => member.id === staffId)?.id,
    date: dateSchema.safeParse(date).success && date >= today ? date : today,
  }
}

/** The choice as the query of an address, in one order. */
export const queryOf = ({ staffId, date }: Choice): string =>
  new URLSearchParams({
    ...(staffId === undefined ? {} : { staffId }),
    date,
  }).toString()

/** A time at which the service can begin, and who is free then. */
export type Time = {
  /** The moment, as the API writes it */
  startTime: string
  /** The time of day at the salon: 「10:00」 */
  label: string
  /** Who is free then, in the order of the API; at least one */
  staffIds: string[]
}

/**
 * The times of a day, the earliest first. The API has one slot for every
 * member of the staff who is free at a time; a customer chooses the time
 * once.
 */
export const timesOf = (
  slots: readonly ModelsAvailableSlotResponse[],
  timezone: string,
): Time[] =>
  Array.from(
    Map.groupBy(slots, (slot) => slot.startTime),
    ([startTime, free]) => ({
      startTime,
      label: timeOfDayAt(startTime, timezone),
      staffIds: free.map((slot) => slot.staffId),
    }),
  ).toSorted((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
