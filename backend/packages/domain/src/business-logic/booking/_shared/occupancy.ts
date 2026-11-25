import { addMinutes, max, min, subMinutes } from 'date-fns'
import type { DbBooking } from '../../../models/booking'
import type { DbStaff } from '../../../models/staff'

/**
 * When a staff member is free for a booking.
 *
 * A booking occupies the staff member of each of its service lines for the
 * time of that line, and for the time the staff member keeps free before
 * and after it (`bufferTimeBefore`, `bufferTimeAfter`). A line without a
 * staff member occupies nobody, and the staff member in charge of a booking
 * is free while no line is theirs. At no moment do more bookings occupy a
 * staff member than `maxConcurrentBookings`.
 */

/** A service line as far as it takes time. */
export type ServiceTime = {
  startTime: Date
  endTime: Date
}

/** The service lines a staff member is wanted for: at least one. */
export type ServiceTimes = readonly [ServiceTime, ...ServiceTime[]]

/** The time a service takes that begins at a moment and lasts so many minutes. */
export const timeOf = (startTime: Date, minutes: number): ServiceTime => ({
  startTime,
  endTime: addMinutes(startTime, minutes),
})

/** The time a service line of another booking takes. */
export type TakenTime = ServiceTime & { bookingId: string }

/** What of a staff member decides whether they are free. */
export type StaffCapacity = Pick<
  DbStaff,
  'bufferTimeBefore' | 'bufferTimeAfter' | 'maxConcurrentBookings'
>

/**
 * The statuses in which a booking occupies nobody: it was cancelled, or the
 * customer did not come.
 */
export const RELEASING_STATUSES: readonly DbBooking['status'][] = [
  'cancelled',
  'no_show',
]

type Occupied = {
  from: Date
  until: Date
}

/** A service line with the time kept free around it; the end is not part of it. */
const occupiedBy = (
  { bufferTimeBefore, bufferTimeAfter }: StaffCapacity,
  { startTime, endTime }: ServiceTime,
): Occupied => ({
  from: subMinutes(startTime, bufferTimeBefore),
  until: addMinutes(endTime, bufferTimeAfter),
})

/**
 * The time outside of which no service line of another booking can stand in
 * the way of the wanted ones: a line that ends at or before `from`, or
 * begins at or after `until`, does not meet any of them, however much time
 * the staff member keeps free.
 */
export const occupancyWindowOf = (
  staff: StaffCapacity,
  wanted: ServiceTimes,
): Occupied => {
  const occupied = wanted.map((time) => occupiedBy(staff, time))

  // The other line keeps its own time free as well.
  return {
    from: subMinutes(
      min(occupied.map(({ from }) => from)),
      staff.bufferTimeAfter,
    ),
    until: addMinutes(
      max(occupied.map(({ until }) => until)),
      staff.bufferTimeBefore,
    ),
  }
}

/**
 * Whether the wanted service lines of one booking would occupy the staff
 * member at a moment at which as many other bookings as the staff member
 * takes at once already do. The lines of one booking count once.
 */
export const isOccupiedBeyondCapacity = (
  staff: StaffCapacity,
  wanted: readonly ServiceTime[],
  taken: readonly TakenTime[],
): boolean => {
  const others = taken.map(({ bookingId, ...time }) => ({
    bookingId,
    ...occupiedBy(staff, time),
  }))
  const bookingsAt = (moment: Date): number =>
    new Set(
      others
        .filter(({ from, until }) => from <= moment && moment < until)
        .map(({ bookingId }) => bookingId),
    ).size

  return wanted
    .map((time) => occupiedBy(staff, time))
    .some(({ from, until }) =>
      // The number of bookings at a moment changes only where one of them
      // begins, so it is counted where the wanted time begins and where
      // another booking begins within it.
      [
        from,
        ...others
          .map((other) => other.from)
          .filter((moment) => from < moment && moment < until),
      ].some((moment) => bookingsAt(moment) >= staff.maxConcurrentBookings),
    )
}

/**
 * The other bookings that occupy the staff member at a moment of the
 * wanted time, each once: the one whose service line begins first comes
 * first. A staff member who takes more than one booking at once can be
 * free although there are some.
 */
export const conflictsOf = (
  staff: StaffCapacity,
  wanted: ServiceTime,
  taken: readonly TakenTime[],
): string[] => {
  const own = occupiedBy(staff, wanted)
  const inTheWay = taken
    .map((time) => ({ ...time, ...occupiedBy(staff, time) }))
    .filter(({ from, until }) => from < own.until && own.from < until)
    .toSorted(
      (one, other) =>
        one.startTime.getTime() - other.startTime.getTime() ||
        (one.bookingId < other.bookingId ? -1 : 1),
    )

  return [...new Set(inTheWay.map(({ bookingId }) => bookingId))]
}
