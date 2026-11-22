import type { BookingId } from '../../../models/booking'
import type { DbPaymentMethod } from '../../../models/payment-method'
import type { RequestedCalculation } from '../../../models/sale'
import type { DbSalon, SalonId } from '../../../models/salon'
import type { DbService } from '../../../models/service'
import { MAX_INTEGER } from '../../../schemas/rules'
import type { ValidationIssue } from '../../../shared'
import {
  amountsOf,
  type BillAmounts,
  type PricedLine,
  pricedLineOf,
} from '../../_shared/amounts'
import { notFound } from '../../booking/_shared/plan'

/**
 * What a sale would come to, before the till enters it. The service lines
 * of the booking count at the amounts they copied from their services
 * when they were booked; the services the request adds count at the
 * prices they have now. The tax is the salon's at this moment, added once
 * to the sum, as for a booking. Nothing is written.
 */

/** What a calculation takes from its salon. */
export type SalonOfCalculation = Pick<DbSalon, 'taxRate'>

/** What a calculation takes from a service it adds. */
export type ServiceOfCalculation = Pick<
  DbService,
  'id' | 'price' | 'discountPrice' | 'taxIncluded'
>

/** What a calculation takes from a payment method of the salon. */
export type PaymentMethodOfCalculation = Pick<
  DbPaymentMethod,
  'method' | 'isActive' | 'minimumAmount' | 'maximumAmount'
>

/**
 * What a calculation refers to, as far as it is there: rows that are not
 * deleted and of the salon the request names.
 */
export type CalculationReferences = {
  /** Null when the salon does not exist or is deleted. */
  salon: SalonOfCalculation | null
  /**
   * The service lines of the booking the request names; null when it
   * names none, or none of the salon.
   */
  booking: { lines: readonly PricedLine[] } | null
  /** Of the services the request names, those that are there, each once. */
  services: readonly ServiceOfCalculation[]
  /** The payment methods of the salon, in the order of `sortOrder` and of the ID. */
  paymentMethods: readonly PaymentMethodOfCalculation[]
}

/**
 * What a sale would come to: the salon and the booking it was calculated
 * for, what its lines come to taken together, and the kinds of payment
 * method that take its total in one payment (`methodsTaking`).
 */
export type CalculatedSale = {
  salonId: SalonId
  bookingId: BookingId | null
  breakdown: BillAmounts
  recommendedMethods: DbPaymentMethod['method'][]
}

/**
 * - `calculated`: what the sale would come to
 * - `invalid`: the request refers to something that is not there, comes to
 *   no line, or to more than a sale holds
 */
export type SaleCalculation =
  | { type: 'calculated'; calculation: CalculatedSale }
  | { type: 'invalid'; issues: ValidationIssue[] }

/** What a request is told that comes to no line. */
const NOTHING_TO_CALCULATE: ValidationIssue = {
  field: 'services',
  rule: 'too_small',
  message: 'Must name a service when the booking has no service line',
}

/** What a request is told that comes to more than a sale holds. */
const TOO_MUCH_TO_CALCULATE: ValidationIssue = {
  field: 'services',
  rule: 'too_big',
  message: `The amounts of a sale must not exceed ${MAX_INTEGER}`,
}

/**
 * The kinds of payment method that take a total in one payment: those of
 * the payment methods in use whose limits admit it, in their order, each
 * kind once. Nothing takes a total of 0, which is no payment.
 */
export const methodsTaking = (
  totalAmount: number,
  paymentMethods: readonly PaymentMethodOfCalculation[],
): DbPaymentMethod['method'][] => {
  if (totalAmount === 0) {
    return []
  }

  const kinds = paymentMethods
    .filter(
      (paymentMethod) =>
        paymentMethod.isActive &&
        (paymentMethod.minimumAmount === null ||
          totalAmount >= paymentMethod.minimumAmount) &&
        (paymentMethod.maximumAmount === null ||
          totalAmount <= paymentMethod.maximumAmount),
    )
    .map(({ method }) => method)

  return kinds.filter((kind, index) => kinds.indexOf(kind) === index)
}

/**
 * Calculates the sale a request describes. The references are looked at
 * in this order: without the salon there is nothing a booking or a service
 * could belong to, so only the salon is reported then; otherwise
 * everything that is not there is reported at once.
 */
export const planCalculation = (
  request: RequestedCalculation,
  references: CalculationReferences,
): SaleCalculation => {
  const { salon, booking } = references
  if (salon === null) {
    return { type: 'invalid', issues: [notFound('salonId', 'a salon')] }
  }

  const added = request.services.map(
    (id) => references.services.find((service) => service.id === id) ?? null,
  )
  const issues = [
    ...(request.bookingId === null || booking !== null
      ? []
      : [notFound('bookingId', 'a booking of the salon')]),
    ...added.flatMap((service, index) =>
      service === null
        ? [notFound(`services.${index}`, 'a service of the salon')]
        : [],
    ),
  ]
  if (issues.length > 0) {
    return { type: 'invalid', issues }
  }

  const lines = [
    ...(booking?.lines ?? []),
    ...added.flatMap((service) =>
      service === null ? [] : [pricedLineOf(service)],
    ),
  ]
  if (lines.length === 0) {
    return { type: 'invalid', issues: [NOTHING_TO_CALCULATE] }
  }

  const breakdown = amountsOf(lines, salon.taxRate)
  if (breakdown === null) {
    return { type: 'invalid', issues: [TOO_MUCH_TO_CALCULATE] }
  }

  return {
    type: 'calculated',
    calculation: {
      salonId: request.salonId,
      bookingId: request.bookingId,
      breakdown,
      recommendedMethods: methodsTaking(
        breakdown.totalAmount,
        references.paymentMethods,
      ),
    },
  }
}
