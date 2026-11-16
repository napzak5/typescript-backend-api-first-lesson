import { tz } from '@date-fns/tz'
import { format, subDays } from 'date-fns'
import { match } from 'ts-pattern'
import type { DbBooking } from '../../../models/booking'
import type { CustomerId } from '../../../models/customer'
import type { PointWrite } from '../../../models/point'
import type {
  PointAdjustRequest,
  PointEarnRequest,
  PointUseRequest,
} from '../../../schemas/point.schema'
import { MAX_INTEGER } from '../../../schemas/rules'
import type { ValidationIssue } from '../../../shared'
import { notFound } from '../../booking/_shared/plan'

/**
 * From a request and what it meets (the balance of the customer and the
 * record it names) to the point transaction it writes.
 *
 * The balance of a customer is that of their latest point transaction, and
 * `customers.loyaltyPoints` is written with it: a movement is planned from
 * the balance as it is while the customer is held, so of two movements of
 * one customer the second meets what the first left.
 */

/** What a request asks of the balance of a customer. */
export type PointMovement =
  | { type: 'earned'; request: PointEarnRequest }
  | { type: 'used'; request: PointUseRequest }
  | { type: 'adjusted'; request: PointAdjustRequest }

/** How many points a movement adds to the balance; a use takes them away. */
export const pointsOf = (movement: PointMovement): number =>
  match(movement)
    .with({ type: 'used' }, ({ request }) => -request.points)
    .with(
      { type: 'earned' },
      { type: 'adjusted' },
      ({ request }) => request.points,
    )
    .exhaustive()

/** A record a point transaction refers to, as it was found and held. */
export type PointReference =
  | { type: 'sale'; customerId: string | null; isVoid: boolean }
  | { type: 'booking'; customerId: string; status: DbBooking['status'] }

/**
 * The statuses of a booking that points are not earned on or used for: a
 * draft is not a booking yet, and a cancelled booking or a no-show is not a
 * visit.
 */
const CLOSED_BOOKINGS: readonly DbBooking['status'][] = [
  'draft',
  'cancelled',
  'no_show',
]

/** Whether points are no longer earned on or used for the record. */
export const isClosed = (reference: PointReference): boolean =>
  match(reference)
    .with({ type: 'sale' }, ({ isVoid }) => isVoid)
    .with({ type: 'booking' }, ({ status }) => CLOSED_BOOKINGS.includes(status))
    .exhaustive()

/**
 * Why a movement is not written, whatever else the request says:
 * - `referenceClosed`: points are earned on and used for neither a void
 *   sale nor a booking that is a draft, cancelled or a no-show. An
 *   adjustment may refer to them, to put right what they moved
 * - `referenceTaken`: a record is earned on once and used for once, so
 *   that a request sent twice does not move points twice
 * - `balanceShort`: the balance would fall below 0
 * - `balanceOverLimit`: the balance would go above the largest value of
 *   the column
 */
export type PointRefusal =
  | { type: 'referenceClosed'; reference: PointReference['type'] }
  | { type: 'referenceTaken' }
  | { type: 'balanceShort' }
  | { type: 'balanceOverLimit' }

/**
 * A point transaction to write, or why the request is not one:
 * - `planned`: what is written
 * - `invalid`: the record the request names is not one of the customer
 *   within the reach of the actor
 * - otherwise why the movement is refused
 */
export type PointPlan =
  | { type: 'planned'; write: PointWrite }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | PointRefusal

/** What a movement meets where it is written. */
export type PointPlanContext = {
  /** The balance of the customer, while the customer is held. */
  balance: number
  /**
   * The record the request names, held; null when it names none, or none
   * with its ID within the reach of the actor.
   */
  reference: PointReference | null
  /**
   * Whether a point transaction of the type of the movement refers to the
   * record already.
   */
  referenceTaken: boolean
}

const expiryDateOf = (movement: PointMovement): string | null =>
  match(movement)
    .with({ type: 'earned' }, ({ request }) => request.expiryDate)
    .with({ type: 'used' }, { type: 'adjusted' }, () => null)
    .exhaustive()

export const planPoints = (
  customerId: CustomerId,
  movement: PointMovement,
  { balance, reference, referenceTaken }: PointPlanContext,
): PointPlan => {
  const { request } = movement
  if (request.referenceType !== null) {
    if (
      reference === null ||
      reference.type !== request.referenceType ||
      reference.customerId !== customerId
    ) {
      return {
        type: 'invalid',
        issues: [
          notFound('referenceId', `a ${request.referenceType} of the customer`),
        ],
      }
    }
    if (movement.type !== 'adjusted' && isClosed(reference)) {
      return { type: 'referenceClosed', reference: reference.type }
    }
    if (movement.type !== 'adjusted' && referenceTaken) {
      return { type: 'referenceTaken' }
    }
  }

  const points = pointsOf(movement)
  const after = balance + points
  if (after < 0) {
    return { type: 'balanceShort' }
  }
  if (after > MAX_INTEGER) {
    return { type: 'balanceOverLimit' }
  }

  return {
    type: 'planned',
    write: {
      customerId,
      transactionType: movement.type,
      points,
      balance: after,
      description: request.description,
      referenceType: request.referenceType,
      referenceId: request.referenceId,
      expiryDate: expiryDateOf(movement),
    },
  }
}

const UTC = tz('UTC')

/**
 * The earliest expiry date a point is given: the day before the date in
 * UTC. A date has no time zone, and the day that is today in UTC has not
 * begun yet for the western end of the earth, where it is still yesterday.
 * A point is used up to its expiry date, that day included.
 */
export const earliestExpiryDateOf = (now: Date): string =>
  format(subDays(now, 1, { in: UTC }), 'yyyy-MM-dd', { in: UTC })

/** An expiry date that has passed everywhere is not given to points. */
export const issuesOfExpiry = (
  expiryDate: string | null,
  now: Date,
): ValidationIssue[] => {
  const earliest = earliestExpiryDateOf(now)
  return expiryDate === null || expiryDate >= earliest
    ? []
    : [
        {
          field: 'expiryDate',
          rule: 'too_small',
          message: `Must not be earlier than ${earliest}`,
        },
      ]
}
