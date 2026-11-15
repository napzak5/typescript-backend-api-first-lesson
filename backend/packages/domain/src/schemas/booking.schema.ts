import { BookingStatusTypeSchema } from '@beauty-salon-backend/generated'
import { addHours, isValid, parseISO } from 'date-fns'
import { z } from 'zod'
import {
  type ApiBookingCancelRequest,
  type ApiBookingCompleteRequest,
  type ApiBookingCreateRequest,
  type ApiBookingRescheduleRequest,
  type ApiBookingSearchRequest,
  type ApiBookingServiceCreateRequest,
  type ApiBookingUpdateRequest,
  bookingIdSchema,
} from '../models/booking'
import { customerIdSchema } from '../models/customer'
import { salonIdSchema } from '../models/salon'
import { serviceIdSchema } from '../models/service'
import { staffIdSchema } from '../models/staff'
import { atLeastOneProperty, MAX_INTEGER, nonBlankText } from './rules'

/**
 * Validation of booking requests. The shapes are checked against the
 * generated API types, the length limits are those of the database columns,
 * and the remaining rules are business rules. The rules that need what a
 * booking refers to (the salon, the customer, the staff members, the
 * services and the other bookings) are the repository's, which holds them
 * while it writes.
 */

/** A booking has no more service lines than this. */
export const MAX_BOOKING_SERVICES = 20

/** Every service of a booking begins within this time of the earliest one. */
export const HOURS_OF_A_VISIT = 24

const MILLISECONDS_OF_A_MINUTE = 60_000

/**
 * A time of a booking: UTC, on a whole minute. It is returned in the one
 * spelling `toISOString` gives, so that two times that are the same moment
 * are the same text.
 */
const minuteInUtc = z.iso
  .datetime()
  // What is not a time has been reported as that.
  .refine((value) => {
    const moment = parseISO(value)
    return !isValid(moment) || moment.getTime() % MILLISECONDS_OF_A_MINUTE === 0
  }, 'Must be on a whole minute')
  .transform((value) => parseISO(value).toISOString())

/**
 * A service line as a request asks for it: of a booking that is entered,
 * and of one a line is added to afterwards.
 */
export const bookingServiceCreateRequestSchema = z.strictObject({
  serviceId: serviceIdSchema,
  staffId: staffIdSchema.nullable(),
  startTime: minuteInUtc,
  notes: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiBookingServiceCreateRequest>

/** A service line of a request that passed the rules of its own. */
export type BookingServiceCreateRequest = z.infer<
  typeof bookingServiceCreateRequestSchema
>

/**
 * A booking is one visit: a service that begins a day after the first one
 * is a date that was mistyped.
 */
const bookingServiceListSchema = z
  .array(bookingServiceCreateRequestSchema)
  .min(1)
  .max(MAX_BOOKING_SERVICES)
  .check((context) => {
    // The times have one spelling, so the earliest is the first as text.
    const [earliest] = context.value.map(({ startTime }) => startTime).sort()
    if (earliest === undefined) {
      return
    }
    const latestStart = addHours(parseISO(earliest), HOURS_OF_A_VISIT)

    context.value.forEach(({ startTime }, index) => {
      if (parseISO(startTime) > latestStart) {
        context.issues.push({
          code: 'custom',
          path: [index, 'startTime'],
          message: `Must be within ${HOURS_OF_A_VISIT} hours of the earliest service`,
          input: startTime,
        })
      }
    })
  })

/** What a salon notes of a booking, when it enters it and afterwards. */
const notedOfBooking = {
  depositAmount: z.number().int().min(0).max(MAX_INTEGER).nullable(),
  customerRequest: nonBlankText.nullable(),
  internalNotes: nonBlankText.nullable(),
  source: nonBlankText.max(50).nullable(),
}

export const bookingCreateRequestSchema = z.strictObject({
  salonId: salonIdSchema,
  customerId: customerIdSchema,
  staffId: staffIdSchema,
  ...notedOfBooking,
  services: bookingServiceListSchema,
}) satisfies z.ZodType<ApiBookingCreateRequest>

/** A create request that passed the rules of its own. */
export type BookingCreateRequest = z.infer<typeof bookingCreateRequestSchema>

export const bookingUpdateRequestSchema = z
  .strictObject(notedOfBooking)
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiBookingUpdateRequest>

export const bookingRescheduleRequestSchema = z.strictObject({
  startTime: minuteInUtc,
  staffId: staffIdSchema,
}) satisfies z.ZodType<ApiBookingRescheduleRequest>

/** A reschedule request that passed the rules of its own. */
export type BookingRescheduleRequest = z.infer<
  typeof bookingRescheduleRequestSchema
>

export const bookingCancelRequestSchema = z.strictObject({
  cancellationReason: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiBookingCancelRequest>

/**
 * A moment something actually happened at, in UTC. It is returned in the
 * one spelling `toISOString` gives, to the millisecond.
 */
const momentInUtc = z.iso
  .datetime()
  .transform((value) => parseISO(value).toISOString())

export const bookingCompleteRequestSchema = z
  .strictObject({
    actualStartTime: momentInUtc.nullable(),
    actualEndTime: momentInUtc.nullable(),
  })
  // The times have one spelling, so the earlier is the first as text.
  .refine(
    ({ actualStartTime, actualEndTime }) =>
      actualStartTime === null ||
      actualEndTime === null ||
      actualStartTime < actualEndTime,
    {
      path: ['actualEndTime'],
      message: 'Must be after actualStartTime',
    },
  ) satisfies z.ZodType<ApiBookingCompleteRequest>

export const bookingSearchRequestSchema = z
  .strictObject({
    limit: z.number().int().min(1).max(100).exactOptional(),
    cursor: bookingIdSchema.exactOptional(),
    salonId: salonIdSchema.exactOptional(),
    customerId: customerIdSchema.exactOptional(),
    staffId: staffIdSchema.exactOptional(),
    status: BookingStatusTypeSchema.exactOptional(),
    bookingDateFrom: z.iso.date().exactOptional(),
    bookingDateTo: z.iso.date().exactOptional(),
  })
  // Two dates in the same format compare as text.
  .refine(
    ({ bookingDateFrom, bookingDateTo }) =>
      bookingDateFrom === undefined ||
      bookingDateTo === undefined ||
      bookingDateFrom <= bookingDateTo,
    {
      path: ['bookingDateTo'],
      message: 'Must not be earlier than bookingDateFrom',
    },
  ) satisfies z.ZodType<ApiBookingSearchRequest>
