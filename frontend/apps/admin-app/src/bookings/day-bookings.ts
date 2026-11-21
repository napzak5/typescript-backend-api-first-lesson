import type { Unread } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import type { More } from '@beauty-salon-frontend/ui'
import type { CustomersRead } from '../customers/customers-api'
import { GONE_SERVICE, NO_MEMBER, UNLISTED_STAFF } from './booking-format'

/** What the names of the bookings are read from. */
export type Names = {
  /** The profiles of the staff of the salon */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** The services of the salon, those switched off as well */
  services: readonly Pick<ModelsServiceResponse, 'id' | 'name'>[]
  /**
   * The customers read for the page of a booking; `undefined` while they
   * are on their way
   */
  customers: (booking: ModelsBookingResponse) => CustomersRead | undefined
}

/** A booking, with the names it is read by. */
export type BookingRow = {
  booking: ModelsBookingResponse
  /** `null`: the customer was removed */
  customer: Pick<ModelsCustomerResponse, 'lastName' | 'firstName'> | null
  /** `null`: a member of the staff the salon does not show */
  staffName: string | null
  /** The service of each line, in the order of the booking; `null`: removed */
  serviceNames: (string | null)[]
}

/** The rows that can be shown, and what stands after them. */
export type Rows = {
  rows: BookingRow[]
  rest:
    | { type: 'none' }
    /** The customers of the next bookings are on their way */
    | { type: 'reading' }
    /** The customers of the next bookings could not be read */
    | { type: 'unread'; reason: Unread }
}

/** The name of a member of the staff, if the salon shows them. */
export const staffNameOf = (
  staffId: string | null,
  staff: Names['staff'],
): string | null => staff.find(({ id }) => id === staffId)?.displayName ?? null

/** Who does a line of a booking, by name: nobody yet, or a member the salon no longer shows. */
export const memberNameOf = (
  staffId: string | null,
  staff: Names['staff'],
): string =>
  staffId === null ? NO_MEMBER : (staffNameOf(staffId, staff) ?? UNLISTED_STAFF)

/** The service of a line of a booking, by name, or that it was removed. */
export const serviceNameOf = (
  serviceId: string,
  services: Names['services'],
): string => services.find(({ id }) => id === serviceId)?.name ?? GONE_SERVICE

/** The names of the services of a booking, in its order. */
export const serviceNamesOf = (
  { services }: Pick<ModelsBookingResponse, 'services'>,
  known: Names['services'],
): (string | null)[] =>
  services
    .toSorted((one, other) => one.sortOrder - other.sortOrder)
    .map(
      ({ serviceId }) => known.find(({ id }) => id === serviceId)?.name ?? null,
    )

/**
 * The bookings as rows, in their order, as far as their customers were
 * read. A booking whose customers are on their way, or could not be read,
 * ends the rows there: what comes after it is not shown before it.
 */
export const rowsOf = (
  bookings: readonly ModelsBookingResponse[],
  names: Names,
): Rows => {
  const rows: BookingRow[] = []
  for (const booking of bookings) {
    const customers = names.customers(booking)
    if (customers === undefined) {
      return { rows, rest: { type: 'reading' } }
    }
    if (customers.type !== 'found') {
      return { rows, rest: { type: 'unread', reason: customers } }
    }
    rows.push({
      booking,
      customer: customers.customers.get(booking.customerId) ?? null,
      staffName: staffNameOf(booking.staffId, names.staff),
      serviceNames: serviceNamesOf(booking, names.services),
    })
  }

  return { rows, rest: { type: 'none' } }
}

/**
 * What stands below the rows. Customers that are on their way are rows
 * that are on their way; customers that could not be read are rows that
 * did not come, and are asked for again. Past the rows, it is what the
 * pages of the list say.
 */
export const moreOfRows = (
  rest: Rows['rest'],
  pages: More,
  readingNamesAgain: boolean,
): More => {
  if (rest.type === 'reading') {
    return 'loading'
  }
  if (rest.type === 'unread') {
    return readingNamesAgain ? 'loading' : 'failed'
  }

  return pages
}

/** The customers of a page of bookings: each one once, in their order. */
export const customerIdsOf = (
  bookings: readonly Pick<ModelsBookingResponse, 'customerId'>[],
): string[] => [...new Set(bookings.map(({ customerId }) => customerId))]
