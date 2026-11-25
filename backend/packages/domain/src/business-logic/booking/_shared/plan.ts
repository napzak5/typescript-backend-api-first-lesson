import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  bookingMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { addMinutes, parseISO } from 'date-fns'
import { match } from 'ts-pattern'
import type { ClientInfo, UserId } from '../../../models/auth'
import type {
  BookingWrite,
  DbNewBookingService,
  RequestedBooking,
  RequestedBookingService,
} from '../../../models/booking'
import type { DbService } from '../../../models/service'
import type { DbStaff } from '../../../models/staff'
import { MAX_INTEGER } from '../../../schemas/rules'
import type { ValidationIssue } from '../../../shared'
import { pricedLineOf } from '../../_shared/amounts'
import type { ServiceTimes, StaffCapacity } from './occupancy'
import { type SalonOfBooking, type SummedLine, summarize } from './summary'

/**
 * From a create request to the rows of a booking. A request names what it
 * refers to and when each service begins; everything else of a booking
 * follows from the rows it refers to, as they are at that moment.
 */

/** What a booking takes from a staff member. */
export type StaffOfBooking = Pick<DbStaff, 'id'> & StaffCapacity

/** What a service line takes from its service. */
export type ServiceOfBooking = Pick<
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
  times: ServiceTimes
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

/**
 * The issue of a property that names what is not there; `message` says
 * what it has to name.
 */
export const notFound = (
  field: string,
  message: LocalizedText,
): ValidationIssue => ({ field, rule: 'not_found', message })

/**
 * The row of a service line: its time, its amounts and whether they
 * include the tax are those of the service (`pricedLineOf`).
 */
export const toServiceRow = (
  line: RequestedBookingService,
  service: ServiceOfBooking,
  sortOrder: number,
): DbNewBookingService => ({
  serviceId: line.serviceId,
  staffId: line.staffId,
  startTime: line.startTime,
  endTime: addMinutes(parseISO(line.startTime), service.duration).toISOString(),
  duration: service.duration,
  ...pricedLineOf(service),
  isCompleted: false,
  completedAt: null,
  notes: line.notes,
  sortOrder,
})

/** A row that is about to be written, as its booking is summed up from it. */
export const summedOf = (row: DbNewBookingService): SummedLine => ({
  startTime: parseISO(row.startTime),
  endTime: parseISO(row.endTime),
  price: row.price,
  discountAmount: row.discountAmount,
  finalPrice: row.finalPrice,
  taxIncluded: row.taxIncluded,
})

/**
 * Plans the booking a request asks for. The references are looked at in
 * this order: without the salon there is nothing a staff member or a
 * service could belong to, so only the salon and the customer are reported
 * then; otherwise everything that is not there is reported at once.
 */
export const planBooking = (
  request: RequestedBooking,
  references: BookingReferences,
  origin: BookingOrigin,
): BookingPlan => {
  const { salon, customerExists } = references
  const customerIssues = customerExists
    ? []
    : [notFound('customerId', ruleMessages.aCustomer)]
  if (salon === null) {
    return {
      type: 'invalid',
      issues: [notFound('salonId', ruleMessages.aSalon), ...customerIssues],
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
  // The rows of the lines whose service is there. A line whose service is
  // not there is an issue below, and then nothing is written.
  const services = requested.flatMap(({ line, service }, index) =>
    service === undefined ? [] : [toServiceRow(line, service, index)],
  )
  const issues = [
    ...customerIssues,
    ...(staffById.has(request.staffId)
      ? []
      : [notFound('staffId', ruleMessages.aStaffMemberOfSalon)]),
    ...requested.flatMap(({ line, service }, index) => [
      ...(service === undefined
        ? [
            notFound(
              `services.${index}.serviceId`,
              ruleMessages.aServiceOfSalon,
            ),
          ]
        : []),
      ...(line.staffId === null || staffById.has(line.staffId)
        ? []
        : [
            notFound(
              `services.${index}.staffId`,
              ruleMessages.aStaffMemberOfSalon,
            ),
          ]),
    ]),
  ]
  if (issues.length > 0) {
    return { type: 'invalid', issues }
  }

  const [first, ...others] = services.map(summedOf)
  if (first === undefined) {
    return {
      type: 'invalid',
      issues: [
        {
          field: 'services',
          rule: 'too_small',
          message: bookingMessages.atLeastOneService,
        },
      ],
    }
  }

  const demands = [...staffById.values()].flatMap((staff): StaffDemand[] => {
    const [firstTime, ...otherTimes] = services
      .filter(({ staffId }) => staffId === staff.id)
      .map(({ startTime, endTime }) => ({
        startTime: parseISO(startTime),
        endTime: parseISO(endTime),
      }))

    return firstTime === undefined
      ? []
      : [{ staff, times: [firstTime, ...otherTimes] }]
  })

  return match(summarize([first, ...others], salon))
    .returnType<BookingPlan>()
    .with({ type: 'timeZoneUnknown' }, (unknown) => unknown)
    .with({ type: 'amountsTooBig' }, () => ({
      type: 'invalid',
      issues: [
        {
          field: 'services',
          rule: 'too_big',
          message: bookingMessages.amountsWithinLimit(MAX_INTEGER),
        },
      ],
    }))
    .with({ type: 'summarized' }, ({ booking }) => ({
      type: 'planned',
      demands,
      write: {
        booking: {
          ...booking,
          bookingNumber: origin.bookingNumber,
          salonId: request.salonId,
          customerId: request.customerId,
          staffId: request.staffId,
          status: 'pending',
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
    }))
    .exhaustive()
}
