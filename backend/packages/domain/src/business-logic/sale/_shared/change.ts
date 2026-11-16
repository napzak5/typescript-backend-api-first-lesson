import type {
  DbPaymentTransaction,
  DbSale,
  SaleChange,
} from '../../../models/sale'
import {
  NO_POINTS_FOR_NOBODY,
  POINTS_OF_A_CUSTOMER,
  type SaleUpdateRequest,
} from '../../../schemas/sale.schema'
import type { ValidationIssue } from '../../../shared'
import { notFound } from '../../booking/_shared/plan'
import {
  dayOfSale,
  issuesOfLine,
  linesOf,
  type SalePlan,
  type SaleReferences,
  type SalonOfSale,
  summed,
  TOO_MUCH,
} from './plan'

/**
 * From a correction of a sale to what it writes, and whether a sale can be
 * voided. A correction names the properties it changes. The sale as it is
 * afterwards is held to what a sale is held to when it is entered; what
 * the request does not name stays and is not looked up again, so a sale
 * whose staff member is gone can still get a note.
 */

/**
 * Why a sale is not corrected, whatever else the request names:
 * - `void`: a void sale is a record of what was taken back
 * - `paymentBegun`: the lines are what was charged, and a sale whose
 *   payment status is no longer `pending` has been charged
 */
export type SaleChangeRefusal = { type: 'void' } | { type: 'paymentBegun' }

export const refusalOfChange = (
  sale: Pick<DbSale, 'isVoid' | 'paymentStatus'>,
  request: SaleUpdateRequest,
): SaleChangeRefusal | null => {
  if (sale.isVoid) {
    return { type: 'void' }
  }

  return request.details !== undefined && sale.paymentStatus !== 'pending'
    ? { type: 'paymentBegun' }
    : null
}

/** A property after a correction: what the request names, or what the sale has. */
const after = <Value>(named: Value | undefined, kept: Value): Value =>
  named === undefined ? kept : named

/**
 * The booking a correction is held to: the one the sale has afterwards,
 * when the request names the booking or the customer. A request that names
 * neither leaves a pair that was checked when it was written: a booking
 * keeps its customer, and one a sale refers to is not deleted.
 */
export const bookingToHold = (
  sale: Pick<DbSale, 'bookingId'>,
  request: SaleUpdateRequest,
): string | null =>
  request.bookingId === undefined && request.customerId === undefined
    ? null
    : after(request.bookingId, sale.bookingId)

/**
 * What a correction refers to, as far as it is there: of what the request
 * names, the rows that are not deleted and, but for the customer, of the
 * salon of the sale. `booking` is the booking of `bookingToHold`, billed
 * when another sale that is not void refers to it. The salon is that of
 * the sale, deleted or not: the days of its sales are days of its time
 * zone.
 */
export type SaleChangeReferences = Omit<SaleReferences, 'salon'> & {
  salon: SalonOfSale
}

/**
 * - `planned`: what to write
 * - otherwise why not, as for a sale that is entered (`SalePlan`)
 */
export type SaleChangePlan =
  | { type: 'planned'; change: SaleChange }
  | Exclude<SalePlan, { type: 'planned' }>

/**
 * What is wrong with the booking of the sale as it is afterwards. A
 * request that names the booking is told so at the booking. One that only
 * names another customer for a sale that keeps its booking is told at the
 * customer, unless the customer is not there, which it has been told.
 */
const issuesOfBooking = (
  request: SaleUpdateRequest,
  customerId: string | null,
  customerIsThere: boolean,
  { booking }: SaleChangeReferences,
): ValidationIssue[] => {
  if (booking !== null && booking.customerId === customerId) {
    return []
  }
  if (request.bookingId !== undefined) {
    return [
      notFound(
        'bookingId',
        'a booking of the salon that is of the customer of the sale',
      ),
    ]
  }

  return customerIsThere
    ? [notFound('customerId', 'the customer of the booking of the sale')]
    : []
}

/**
 * Plans a correction of a sale that can be corrected (`refusalOfChange`).
 * Everything that is not there or does not go together is reported at
 * once; then the sums, the day and the booking are looked at, in the
 * order of a sale that is entered.
 */
export const planSaleChange = (
  sale: DbSale,
  request: SaleUpdateRequest,
  references: SaleChangeReferences,
): SaleChangePlan => {
  const { details, ...columns } = request
  const customerId = after(request.customerId, sale.customerId)
  const customerIsThere =
    request.customerId === undefined ||
    request.customerId === null ||
    references.customerExists
  const points = {
    pointsUsed: after(request.pointsUsed, sale.pointsUsed),
    pointsEarned: after(request.pointsEarned, sale.pointsEarned),
  }

  const issues = [
    ...(customerIsThere ? [] : [notFound('customerId', 'a customer')]),
    ...(request.staffId === undefined ||
    request.staffId === null ||
    references.staffIds.includes(request.staffId)
      ? []
      : [notFound('staffId', 'a staff member of the salon')]),
    ...(bookingToHold(sale, request) === null
      ? []
      : issuesOfBooking(request, customerId, customerIsThere, references)),
    ...(customerId === null
      ? POINTS_OF_A_CUSTOMER.flatMap((name) =>
          points[name] === null
            ? []
            : [{ field: name, rule: 'custom', message: NO_POINTS_FOR_NOBODY }],
        )
      : []),
    ...(details ?? []).flatMap((line, index) =>
      issuesOfLine(line, index, references),
    ),
  ]
  if (issues.length > 0) {
    return { type: 'invalid', issues }
  }

  const sums = details === undefined ? {} : summed(details)
  if (sums === null) {
    return { type: 'invalid', issues: [TOO_MUCH] }
  }

  const saleDate =
    request.saleTime === undefined
      ? undefined
      : dayOfSale(request.saleTime, references.salon.timezone)
  if (saleDate === null) {
    return { type: 'timeZoneUnknown' }
  }
  if (references.booking?.isBilled === true) {
    return { type: 'bookingBilled' }
  }

  return {
    type: 'planned',
    change: {
      sale: {
        ...columns,
        ...sums,
        ...(saleDate === undefined ? {} : { saleDate }),
      },
      details: details === undefined ? null : linesOf(details),
    },
  }
}

/**
 * Why a sale is not voided:
 * - `void`: it is void already
 * - `paid`: a payment of it holds money that was not given back
 */
export type SaleVoidRefusal = { type: 'void' } | { type: 'paid' }

/** The statuses of a payment that holds money of the customer. */
const HELD: readonly DbPaymentTransaction['status'][] = [
  'completed',
  'partial_refund',
]

export const refusalOfVoid = (
  sale: Pick<DbSale, 'isVoid'>,
  payments: readonly Pick<DbPaymentTransaction, 'status'>[],
): SaleVoidRefusal | null => {
  if (sale.isVoid) {
    return { type: 'void' }
  }

  return payments.some(({ status }) => HELD.includes(status))
    ? { type: 'paid' }
    : null
}
