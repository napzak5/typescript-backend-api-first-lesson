import {
  ruleMessages,
  saleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { format, isValid, parseISO } from 'date-fns'
import type { DbBooking } from '../../../models/booking'
import type {
  DbNewSalesDetail,
  RequestedSale,
  RequestedSalesDetail,
  SaleWrite,
} from '../../../models/sale'
import type { DbSalon } from '../../../models/salon'
import { inTimeZone, MAX_INTEGER } from '../../../schemas/rules'
import { PRODUCT_ITEM, SERVICE_ITEM } from '../../../schemas/sale.schema'
import type { ValidationIssue } from '../../../shared'
import { notFound } from '../../booking/_shared/plan'

/**
 * From a create request to the rows of a sale. A sale is what the till
 * charged: the request states the lines with their names and amounts, and
 * the sale says of them what they come to. What a sale refers to only has
 * to be there and of the salon.
 */

/** What a sale takes from its salon. */
export type SalonOfSale = Pick<DbSalon, 'timezone'>

/** The booking a sale is the bill of. */
export type BookingOfSale = Pick<DbBooking, 'customerId'> & {
  /** Whether a sale that is not void already refers to the booking. */
  isBilled: boolean
}

/**
 * What a create request refers to, as far as it is there: rows that are
 * not deleted and, but for the customer, of the salon the request names.
 */
export type SaleReferences = {
  /** Null when the salon does not exist or is deleted. */
  salon: SalonOfSale | null
  /** Whether the customer of the request is there; of a request without one, false. */
  customerExists: boolean
  /** Of the staff members the request names, those that are there. */
  staffIds: readonly string[]
  /** Of the services its lines name, those that are there. */
  serviceIds: readonly string[]
  /** Of the products its lines name, those that are there. */
  productIds: readonly string[]
  /** Null when the request names no booking, or none of the salon. */
  booking: BookingOfSale | null
}

/** What a sale keeps of how it came to be. */
export type SaleOrigin = {
  saleNumber: string
}

/**
 * - `planned`: the rows to write
 * - `invalid`: the request refers to something that is not there, or the
 *   amounts are more than a sale can hold
 * - `timeZoneUnknown`: the salon has a time zone the runtime does not
 *   know, so the day of the sale cannot be told
 * - `bookingBilled`: the booking has a sale that is not void
 */
export type SalePlan =
  | { type: 'planned'; write: SaleWrite }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | { type: 'timeZoneUnknown' }
  | { type: 'bookingBilled' }

const sumOf = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/**
 * What a sale says of its lines taken together; null when that is more
 * than it holds. Every line is known to agree with itself: its price is
 * its total and its discount less its tax, at most twice what an integer
 * column holds, so the lines of a sale are summed exactly. The discount
 * of a sale is within its subtotal and its tax within its total, because
 * those of every line are; neither needs a look of its own.
 */
export const summed = (
  details: readonly RequestedSalesDetail[],
): Pick<
  SaleWrite['sale'],
  'subtotal' | 'discountAmount' | 'taxAmount' | 'totalAmount'
> | null => {
  const subtotal = sumOf(details.map((line) => line.quantity * line.unitPrice))
  const discountAmount = sumOf(details.map((line) => line.discountAmount))
  const taxAmount = sumOf(details.map((line) => line.taxAmount))
  const totalAmount = subtotal - discountAmount + taxAmount

  return subtotal > MAX_INTEGER || totalAmount > MAX_INTEGER
    ? null
    : { subtotal, discountAmount, taxAmount, totalAmount }
}

/** What the line of a request names that is not there. */
export const issuesOfLine = (
  line: RequestedSalesDetail,
  index: number,
  references: SaleReferences,
): ValidationIssue[] => [
  ...(line.staffId === null || references.staffIds.includes(line.staffId)
    ? []
    : [notFound(`details.${index}.staffId`, ruleMessages.aStaffMemberOfSalon)]),
  ...(line.itemId !== null &&
  line.itemType === SERVICE_ITEM &&
  !references.serviceIds.includes(line.itemId)
    ? [notFound(`details.${index}.itemId`, ruleMessages.aServiceOfSalon)]
    : []),
  ...(line.itemId !== null &&
  line.itemType === PRODUCT_ITEM &&
  !references.productIds.includes(line.itemId)
    ? [notFound(`details.${index}.itemId`, ruleMessages.aProductOfSalon)]
    : []),
]

/** What lines are told that come to more than a sale holds. */
export const TOO_MUCH: ValidationIssue = {
  field: 'details',
  rule: 'too_big',
  message: saleMessages.amountsWithinLimit(MAX_INTEGER),
}

/**
 * The day of a sale: the day its moment falls on in the time zone of the
 * salon. Null when the runtime does not know the time zone.
 */
export const dayOfSale = (
  saleTime: string,
  timezone: string,
): string | null => {
  const day = inTimeZone(parseISO(saleTime), timezone)

  return isValid(day) ? format(day, 'yyyy-MM-dd') : null
}

/** The rows of the lines a request states. */
export const linesOf = (
  details: readonly RequestedSalesDetail[],
): DbNewSalesDetail[] =>
  details.map((line) => ({
    itemType: line.itemType,
    itemId: line.itemId,
    itemName: line.itemName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxAmount: line.taxAmount,
    totalAmount: line.totalAmount,
    staffId: line.staffId,
    // A `numeric` column is written as text.
    commissionRate:
      line.commissionRate === null ? null : line.commissionRate.toFixed(2),
    commissionAmount: line.commissionAmount,
    notes: line.notes,
    sortOrder: line.sortOrder,
  }))

/**
 * Plans the sale a request asks for. The references are looked at in this
 * order: without the salon there is nothing a staff member, a booking or
 * what was sold could belong to, so only the salon and the customer are
 * reported then; otherwise everything that is not there is reported at
 * once.
 *
 * The sale of a booking is a sale to the customer who booked: a booking
 * of another customer, or one named by a sale to nobody, is not the
 * booking of this sale.
 */
export const planSale = (
  request: RequestedSale,
  references: SaleReferences,
  origin: SaleOrigin,
): SalePlan => {
  const { salon, booking } = references
  const customerIssues =
    request.customerId === null || references.customerExists
      ? []
      : [notFound('customerId', ruleMessages.aCustomer)]
  if (salon === null) {
    return {
      type: 'invalid',
      issues: [notFound('salonId', ruleMessages.aSalon), ...customerIssues],
    }
  }

  const issues = [
    ...customerIssues,
    ...(request.staffId === null ||
    references.staffIds.includes(request.staffId)
      ? []
      : [notFound('staffId', ruleMessages.aStaffMemberOfSalon)]),
    ...(request.bookingId === null ||
    (booking !== null && booking.customerId === request.customerId)
      ? []
      : [notFound('bookingId', saleMessages.aBookingOfCustomerOfSale)]),
    ...request.details.flatMap((line, index) =>
      issuesOfLine(line, index, references),
    ),
  ]
  if (issues.length > 0) {
    return { type: 'invalid', issues }
  }

  const sums = summed(request.details)
  if (sums === null) {
    return { type: 'invalid', issues: [TOO_MUCH] }
  }

  const saleDate = dayOfSale(request.saleTime, salon.timezone)
  if (saleDate === null) {
    return { type: 'timeZoneUnknown' }
  }
  if (booking?.isBilled === true) {
    return { type: 'bookingBilled' }
  }

  return {
    type: 'planned',
    write: {
      sale: {
        ...sums,
        saleNumber: origin.saleNumber,
        salonId: request.salonId,
        customerId: request.customerId,
        staffId: request.staffId,
        bookingId: request.bookingId,
        saleDate,
        saleTime: request.saleTime,
        pointsUsed: request.pointsUsed,
        pointsEarned: request.pointsEarned,
        paymentStatus: 'pending',
        isVoid: false,
        voidedAt: null,
        voidReason: null,
        notes: request.notes,
      },
      details: linesOf(request.details),
    },
  }
}
