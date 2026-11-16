import { parseISO } from 'date-fns'
import { match } from 'ts-pattern'
import { SalonReadMapper } from '../../../mappers/read/salon.mapper'
import type {
  CalendarDay,
  SalonOfSlots,
  ServiceOfSlots,
} from '../../../models/available-slot'
import type { BookingWrite } from '../../../models/booking'
import type { CustomerId, DbCustomer } from '../../../models/customer'
import type { DbOpeningHours } from '../../../models/salon'
import type { CustomerBookingCreateRequest } from '../../../schemas/booking.schema'
import type { DomainError, ValidationIssue } from '../../../shared'
import { booksOnline } from '../../available-slot/_shared/acceptance'
import {
  datesAround,
  widestDaysAround,
} from '../../available-slot/_shared/salon-time'
import { type StaffOfDay, slotsOf } from '../../available-slot/_shared/slots'
import type { TimeRange } from '../../available-slot/_shared/time-ranges'
import { type ServiceTime, timeOf } from '../../booking/_shared/occupancy'
import {
  type BookingOrigin,
  notFound,
  planBooking,
  type ServiceOfBooking,
} from '../../booking/_shared/plan'
import type { SalonOfBooking } from '../../booking/_shared/summary'

/**
 * From the request of a customer to the rows of a booking.
 *
 * A customer books what the list of available slots offers: one slot, for
 * one service. The request is held to everything the list is held to, at
 * the moment the booking is written, and to what is the customer's own:
 * the salons take bookings from them, and they are not booked elsewhere at
 * that time. The rows are those the salon would enter for the same visit.
 */

/** How a booking came in that a customer made by themself. */
export const ONLINE = 'online'

/** Who books, and the moment at which they do. */
export type CustomerBooker = {
  customerId: CustomerId
  now: Date
}

/** A row of the calendar of a salon, with the date it is for. */
export type CalendarDayOfDate = CalendarDay & Pick<DbOpeningHours, 'date'>

/**
 * What the request of a customer refers to and meets, as far as it is
 * there: rows that are not deleted, and of the service and the staff
 * member only those of the salon the request names.
 */
export type CustomerBookingReferences = {
  /** Null when the customer does not exist or is deleted. */
  customer: Pick<DbCustomer, 'isActive' | 'customerStatus'> | null
  /** Null when the salon does not exist or is deleted. */
  salon: (SalonOfSlots & SalonOfBooking) | null
  service: (ServiceOfBooking & ServiceOfSlots) | null
  /**
   * The staff member with the rows of their schedule that can apply at
   * the time, and with the service lines other bookings have for them
   * around it.
   */
  staff: StaffOfDay | null
  /** The rows of the salon's calendar for the dates the time can be on. */
  calendarDays: readonly CalendarDayOfDate[]
  /**
   * When the lines begin that bookings have of the service around the
   * time; cancelled bookings and no-shows are not among them.
   */
  serviceLineStarts: readonly Date[]
  /**
   * The times of the other bookings of the customer around the time, at
   * whatever salon; cancelled bookings and no-shows are not among them.
   */
  customerTimes: readonly ServiceTime[]
}

/**
 * - `planned`: the rows to write
 * - `profileNotFound`: the customer who books is not there
 * - `invalid`: the request refers to something that is not there, or the
 *   amounts are more than a booking can hold
 * - `timeZoneUnknown`: the salon has a time zone the runtime does not know
 * - `hoursUnreadable`: the stored hours of the salon are not what the
 *   model says they are
 * - `customerNotAccepted`: the customer does not book by themself
 * - `notASlot`: the time is not an available slot of the service with the
 *   staff member
 * - `customerOccupied`: another booking of the customer is at that time
 */
export type CustomerBookingPlan =
  | { type: 'planned'; write: BookingWrite }
  | { type: 'profileNotFound' }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | { type: 'timeZoneUnknown' }
  | { type: 'hoursUnreadable'; error: DomainError }
  | { type: 'customerNotAccepted' }
  | { type: 'notASlot' }
  | { type: 'customerOccupied' }

/**
 * The dates (`YYYY-MM-DD`) the calendar of the salon is read for: those
 * the time of the request can be on. The time zone of the salon is the
 * plan's to read, so what the plan is made from is read for every date it
 * could come to.
 */
export const candidateDatesOf = (
  request: CustomerBookingCreateRequest,
): string[] => datesAround(parseISO(request.startTime))

/**
 * The time within which the bookings are read that the plan looks at:
 * that of the dates above in every time zone, and so many minutes around
 * it, which are the time a staff member keeps free around a booking.
 */
export const candidateTimeOf = (
  request: CustomerBookingCreateRequest,
  minutesAround: number,
): TimeRange => widestDaysAround(parseISO(request.startTime), minutesAround)

/** Whether two times have a moment in common; the end of a time is not part of it. */
const meet = (one: ServiceTime, other: ServiceTime): boolean =>
  one.startTime < other.endTime && other.startTime < one.endTime

/**
 * Plans the booking a customer asks for. What is not there is reported
 * first: without the salon there is nothing the service or the staff
 * member could belong to, so only the salon is reported then, and
 * otherwise both at once.
 */
export const planCustomerBooking = (
  request: CustomerBookingCreateRequest,
  { customerId, now }: CustomerBooker,
  references: CustomerBookingReferences,
  origin: BookingOrigin,
): CustomerBookingPlan => {
  const { customer, salon, service, staff } = references
  if (customer === null) {
    return { type: 'profileNotFound' }
  }
  if (salon === null) {
    return { type: 'invalid', issues: [notFound('salonId', 'a salon')] }
  }
  if (service === null || staff === null) {
    return {
      type: 'invalid',
      issues: [
        ...(service === null
          ? [notFound('serviceId', 'a service of the salon')]
          : []),
        ...(staff === null
          ? [notFound('staffId', 'a staff member of the salon')]
          : []),
      ],
    }
  }

  // The rows are those of a booking the salon enters for the same visit.
  const entered = planBooking(
    {
      salonId: request.salonId,
      customerId,
      staffId: request.staffId,
      depositAmount: null,
      customerRequest: request.customerRequest,
      internalNotes: null,
      source: ONLINE,
      services: [
        {
          serviceId: request.serviceId,
          staffId: request.staffId,
          startTime: request.startTime,
          notes: null,
        },
      ],
    },
    { salon, customerExists: true, staff: [staff], services: [service] },
    origin,
  )

  return match(entered)
    .returnType<CustomerBookingPlan>()
    .with({ type: 'timeZoneUnknown' }, (unknown) => unknown)
    .with({ type: 'invalid' }, ({ issues }) => ({
      type: 'invalid',
      // Everything the request names is there, so this is about what the
      // service costs: the one service of the request is `serviceId`.
      issues: issues.map((issue) => ({ ...issue, field: 'serviceId' })),
    }))
    .with({ type: 'planned' }, ({ write }) => {
      if (!booksOnline(customer)) {
        return { type: 'customerNotAccepted' }
      }
      const businessHours = SalonReadMapper.toBusinessHours(salon)
      if (businessHours.type === 'error') {
        return { type: 'hoursUnreadable', error: businessHours.error }
      }

      // The day of the visit is the date the slot is one of.
      const date = write.booking.bookingDate
      const startTime = parseISO(request.startTime)
      const day = slotsOf({
        date,
        now,
        duration: service.duration,
        salon: {
          isActive: salon.isActive,
          timezone: salon.timezone,
          businessHours: businessHours.data,
        },
        calendarDay:
          references.calendarDays.find((row) => row.date === date) ?? null,
        service,
        serviceLineStarts: references.serviceLineStarts,
        staff: [staff],
      })
      if (day.type === 'timeZoneUnknown') {
        return day
      }
      if (
        !day.slots.some(
          (slot) => slot.startTime.getTime() === startTime.getTime(),
        )
      ) {
        return { type: 'notASlot' }
      }

      const wanted = timeOf(startTime, service.duration)
      if (references.customerTimes.some((other) => meet(wanted, other))) {
        return { type: 'customerOccupied' }
      }

      return { type: 'planned', write }
    })
    .exhaustive()
}
