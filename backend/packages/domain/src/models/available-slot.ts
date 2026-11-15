import type { components, operations } from '@beauty-salon-backend/generated'
import type { DbOpeningHours, DbSalon } from './salon'
import type { DbService } from './service'
import type { DbStaff } from './staff'

/**
 * The available slots of a salon: the times at which a staff member can
 * begin a service. No table holds them; they are worked out from the hours
 * of the salon, the schedules of its staff and the bookings there are.
 */

// API types, generated from TypeSpec
export type ApiAvailableSlotResponse =
  components['schemas']['Models.AvailableSlotResponse']
export type ApiAvailableSlotSearchRequest = NonNullable<
  operations['AvailableSlotCrud_list']['parameters']['query']
>
export type ApiAvailableSlotCheckRequest =
  components['schemas']['Models.AvailableSlotCheckRequest']
export type ApiAvailableSlotCheckResponse =
  components['schemas']['Models.AvailableSlotCheckResponse']

/** What of a salon decides when it takes bookings. */
export type SalonOfSlots = Pick<
  DbSalon,
  'id' | 'isActive' | 'timezone' | 'businessHours'
>

/** The row of the salon's calendar for a date, as far as it says when the salon is open. */
export type CalendarDay = Pick<DbOpeningHours, 'openTime' | 'closeTime'>

/** What of a service decides whether, when and by whom it can be booked. */
export type ServiceOfSlots = Pick<
  DbService,
  | 'duration'
  | 'isActive'
  | 'serviceStatus'
  | 'allowOnlineBooking'
  | 'availability'
  | 'bookingRequirements'
  | 'maxBookingsPerDay'
  | 'requiredStaffLevel'
>

/** What of a staff member decides whether they take a booking. */
export type StaffOfSlots = Pick<
  DbStaff,
  | 'id'
  | 'level'
  | 'isActive'
  | 'canReceiveBookings'
  | 'bufferTimeBefore'
  | 'bufferTimeAfter'
  | 'maxConcurrentBookings'
>
