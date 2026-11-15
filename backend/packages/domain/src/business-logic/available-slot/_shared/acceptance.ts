import { match } from 'ts-pattern'
import type {
  SalonOfSlots,
  ServiceOfSlots,
  StaffOfSlots,
} from '../../../models/available-slot'
import { dayOfWeekOf } from '../../../schemas/rules'

/**
 * What a salon has set for the bookings its customers make: whether the
 * salon, a service and a staff member take such a booking at all. The
 * ledger does not ask: a booking the salon enters itself is the salon's
 * decision.
 */

/** The levels of the staff, from the one that qualifies for the least. */
const LEVELS: readonly StaffOfSlots['level'][] = [
  'junior',
  'stylist',
  'senior',
  'expert',
  'director',
]

const WEEKEND: readonly (string | null)[] = ['saturday', 'sunday']

/** Whether the salon takes bookings from customers. */
export const takesBookings = (salon: Pick<SalonOfSlots, 'isActive'>): boolean =>
  salon.isActive

/**
 * Whether customers can book the service: it is on the menu, it is offered
 * now, and the salon takes bookings for it online.
 */
export const isBookable = (service: ServiceOfSlots): boolean =>
  service.isActive &&
  service.serviceStatus === 'active' &&
  service.allowOnlineBooking

/**
 * Whether the service is offered on a date (`YYYY-MM-DD`) at all. Only the
 * days of the week are told here: a service by appointment is booked by
 * taking a slot, and a seasonal one is offered while the salon says so
 * with its status.
 */
export const isOfferedOn = (
  service: Pick<ServiceOfSlots, 'availability'>,
  date: string,
): boolean => {
  const isWeekend = WEEKEND.includes(dayOfWeekOf(date))

  return match(service.availability)
    .with('weekdays_only', () => !isWeekend)
    .with('weekends_only', () => isWeekend)
    .with('always', 'by_appointment_only', 'seasonal', () => true)
    .exhaustive()
}

/**
 * Whether the service can still be booked for a date when today is another
 * or the same: a service that has to be booked in advance is not booked
 * for the day itself.
 */
export const isBookedInTime = (
  service: Pick<ServiceOfSlots, 'bookingRequirements'>,
  date: string,
  today: string,
): boolean =>
  !service.bookingRequirements.includes('advance_booking_required') ||
  date > today

/**
 * Whether a day on which the service is booked so many times has room for
 * one more.
 */
export const hasRoomFor = (
  service: Pick<ServiceOfSlots, 'maxBookingsPerDay'>,
  bookedOnDay: number,
): boolean =>
  service.maxBookingsPerDay === null || bookedOnDay < service.maxBookingsPerDay

/**
 * Whether the staff member takes bookings of the service from customers:
 * they work at the salon, they take bookings, and their level is at least
 * the one the service asks for.
 */
export const takesBookingsOf = (
  staff: Pick<StaffOfSlots, 'isActive' | 'canReceiveBookings' | 'level'>,
  service: Pick<ServiceOfSlots, 'requiredStaffLevel'>,
): boolean =>
  staff.isActive &&
  staff.canReceiveBookings &&
  (service.requiredStaffLevel === null ||
    LEVELS.indexOf(staff.level) >= LEVELS.indexOf(service.requiredStaffLevel))
