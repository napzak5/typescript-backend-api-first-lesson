import {
  addMinutes,
  differenceInMinutes,
  format,
  isValid,
  parseISO,
} from 'date-fns'
import type { ClientInfo, UserId } from '../../../models/auth'
import type { BookingWrite, DbNewBookingService } from '../../../models/booking'
import type { DbSalon } from '../../../models/salon'
import type { DbService } from '../../../models/service'
import type { DbStaff } from '../../../models/staff'
import type { BookingCreateRequest } from '../../../schemas/booking.schema'
import { inTimeZone, MAX_INTEGER } from '../../../schemas/rules'
import type { ValidationIssue } from '../../../shared'
import type { ServiceTime, StaffCapacity } from './occupancy'

/**
 * From a create request to the rows of a booking. A request names what it
 * refers to and when each service begins; everything else of a booking
 * follows from the rows it refers to, as they are at that moment.
 */

/** What a booking takes from its salon. */
type SalonOfBooking = Pick<DbSalon, 'timezone' | 'taxRate'>

/** What a booking takes from a staff member. */
export type StaffOfBooking = Pick<DbStaff, 'id'> & StaffCapacity

/** What a service line takes from its service. */
type ServiceOfBooking = Pick<
  DbService,
  'id' | 'duration' | 'price' | 'discountPrice' | 'taxIncluded'
>

/**
 * What a create request refers to, as far as it is there: rows that are
 * not deleted, and of the staff members and the services only those of the
 * salon the request names.
 */
export type BookingReferences = {
  /** Null when the salon does not exist or is deleted. */
  salon: SalonOfBooking | null
  customerExists: boolean
  staff: readonly StaffOfBooking[]
  services: readonly ServiceOfBooking[]
}

/** What a booking keeps of how it came to be. */
export type BookingOrigin = {
  bookingNumber: string
  createdBy: UserId
  client: ClientInfo
}

/** The service lines of a booking that one staff member has. */
export type StaffDemand = {
  staff: StaffOfBooking
  times: ServiceTime[]
}

/**
 * - `planned`: the rows to write, and whom the booking occupies when
 * - `invalid`: the request refers to something that is not there, or the
 *   amounts are more than a booking can hold
 * - `timeZoneUnknown`: the salon has a time zone the runtime does not
 *   know, so the day of the visit cannot be told
 */
export type BookingPlan =
  | { type: 'planned'; write: BookingWrite; demands: StaffDemand[] }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | { type: 'timeZoneUnknown' }

export const notFound = (field: string, what: string): ValidationIssue => ({
  field,
  rule: 'not_found',
  message: `Must name ${what}`,
})

/** A percentage of the `numeric(5, 2)` column, in hundredths of a percent. */
const hundredthsOf = (percentage: string): bigint =>
  BigInt(Math.round(Number(percentage) * 100))

/**
 * The consumption tax that is added to an amount without tax: the amount
 * times the rate, with the fraction of a yen dropped. It is computed once
 * for the sum of a booking and not for every line, the way the tax of an
 * invoice is rounded once for each rate.
 */
const taxAddedTo = (amount: number, taxRate: string): number =>
  Number((BigInt(amount) * hundredthsOf(taxRate)) / 10_000n)

const sumOf = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/**
 * The row of a service line: its time and its amounts are those of the
 * service, the discount what the discounted price takes off the price.
 */
const toServiceRow = (
  line: BookingCreateRequest['services'][number],
  service: ServiceOfBooking,
  sortOrder: number,
): DbNewBookingService => {
  const discountAmount =
    service.price - (service.discountPrice ?? service.price)

  return {
    serviceId: line.serviceId,
    staffId: line.staffId,
    startTime: line.startTime,
    endTime: addMinutes(
      parseISO(line.startTime),
      service.duration,
    ).toISOString(),
    duration: service.duration,
    price: service.price,
    discountAmount,
    finalPrice: service.price - discountAmount,
    isCompleted: false,
    completedAt: null,
    notes: line.notes,
    sortOrder,
  }
}

/**
 * Plans the booking a request asks for. The references are looked at in
 * this order: without the salon there is nothing a staff member or a
 * service could belong to, so only the salon and the customer are reported
 * then; otherwise everything that is not there is reported at once.
 */
export const planBooking = (
  request: BookingCreateRequest,
  references: BookingReferences,
  origin: BookingOrigin,
): BookingPlan => {
  const { salon, customerExists } = references
  const customerIssues = customerExists
    ? []
    : [notFound('customerId', 'a customer')]
  if (salon === null) {
    return {
      type: 'invalid',
      issues: [notFound('salonId', 'a salon'), ...customerIssues],
    }
  }

  const staffById = new Map(references.staff.map((staff) => [staff.id, staff]))
  const servicesById = new Map(
    references.services.map((service) => [service.id, service]),
  )
  const requested = request.services.map((line) => ({
    line,
    service: servicesById.get(line.serviceId),
  }))
  const issues = [
    ...customerIssues,
    ...(staffById.has(request.staffId)
      ? []
      : [notFound('staffId', 'a staff member of the salon')]),
    ...requested.flatMap(({ line, service }, index) => [
      ...(service === undefined
        ? [notFound(`services.${index}.serviceId`, 'a service of the salon')]
        : []),
      ...(line.staffId === null || staffById.has(line.staffId)
        ? []
        : [
            notFound(
              `services.${index}.staffId`,
              'a staff member of the salon',
            ),
          ]),
    ]),
  ]
  if (issues.length > 0) {
    return { type: 'invalid', issues }
  }

  // Every service was found, so every line has its row.
  const lines = requested.flatMap(({ line, service }, index) =>
    service === undefined
      ? []
      : [
          {
            row: toServiceRow(line, service, index),
            taxIncluded: service.taxIncluded,
          },
        ],
  )
  const services = lines.map(({ row }) => row)
  // The times have one spelling, so they sort as text.
  const firstStart = services
    .map(({ startTime }) => startTime)
    .sort()
    .at(0)
  const lastEnd = services
    .map(({ endTime }) => endTime)
    .sort()
    .at(-1)
  if (firstStart === undefined || lastEnd === undefined) {
    return {
      type: 'invalid',
      issues: [
        {
          field: 'services',
          rule: 'too_small',
          message: 'Must have at least one service',
        },
      ],
    }
  }

  const visit = inTimeZone(parseISO(firstStart), salon.timezone)
  if (!isValid(visit)) {
    return { type: 'timeZoneUnknown' }
  }

  const subtotal = sumOf(services.map(({ price }) => price))
  const discountAmount = sumOf(
    services.map((service) => service.discountAmount),
  )
  const taxAmount = taxAddedTo(
    sumOf(
      lines
        .filter(({ taxIncluded }) => !taxIncluded)
        .map(({ row }) => row.finalPrice),
    ),
    salon.taxRate,
  )
  const totalAmount = subtotal - discountAmount + taxAmount
  if (subtotal > MAX_INTEGER || totalAmount > MAX_INTEGER) {
    return {
      type: 'invalid',
      issues: [
        {
          field: 'services',
          rule: 'too_big',
          message: `The amounts of a booking must not exceed ${MAX_INTEGER}`,
        },
      ],
    }
  }

  const demands = [...staffById.values()].flatMap((staff) => {
    const times = services
      .filter(({ staffId }) => staffId === staff.id)
      .map(({ startTime, endTime }) => ({
        startTime: parseISO(startTime),
        endTime: parseISO(endTime),
      }))

    return times.length === 0 ? [] : [{ staff, times }]
  })

  return {
    type: 'planned',
    demands,
    write: {
      booking: {
        bookingNumber: origin.bookingNumber,
        salonId: request.salonId,
        customerId: request.customerId,
        staffId: request.staffId,
        bookingDate: format(visit, 'yyyy-MM-dd'),
        startTime: firstStart,
        endTime: lastEnd,
        duration: differenceInMinutes(parseISO(lastEnd), parseISO(firstStart)),
        status: 'pending',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        depositAmount: request.depositAmount,
        pointsUsed: null,
        pointsEarned: null,
        customerRequest: request.customerRequest,
        internalNotes: request.internalNotes,
        reminderSent: false,
        reminderSentAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        cancellationFee: null,
        completedAt: null,
        actualStartTime: null,
        actualEndTime: null,
        source: request.source,
        ipAddress: origin.client.ipAddress,
        userAgent: origin.client.userAgent,
      },
      services,
      statusChange: {
        fromStatus: null,
        toStatus: 'pending',
        changedBy: origin.createdBy,
        reason: null,
        metadata: null,
      },
    },
  }
}
