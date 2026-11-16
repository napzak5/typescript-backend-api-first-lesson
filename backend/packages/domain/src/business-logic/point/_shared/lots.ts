import type { DbPointTransaction, PointWrite } from '../../../models/point'

/**
 * What is left of one increase of a balance: an earning, or an adjustment
 * (or a transfer) upwards. Only an earning has an expiry date; the others,
 * the opening balances among them, never expire.
 */
export type PointLot = {
  /** The point transaction that added the points. */
  transaction: DbPointTransaction
  /** The last day the points can be used (`YYYY-MM-DD`), or null. */
  expiryDate: string | null
  /** How many of its points no decrease has taken. */
  left: number
}

/**
 * The lots in the order they are taken: the earliest expiry date first,
 * those without one last, and lots of one date in the order they were
 * written (the sort is stable).
 */
const byExpiry = (a: PointLot, b: PointLot): number => {
  if (a.expiryDate === b.expiryDate) {
    return 0
  }
  if (a.expiryDate === null) {
    return 1
  }
  if (b.expiryDate === null) {
    return -1
  }
  return a.expiryDate < b.expiryDate ? -1 : 1
}

/**
 * The lots of a customer with points left, in the order they were written.
 * `transactions` are all the point transactions of the customer in the
 * order they were written (`createdAt`, then `id`). Each decrease (a use,
 * an expiry, an adjustment downwards) takes points from the lots there are
 * at that moment, the earliest expiry date first; a later earning is never
 * taken by an earlier use. What is left adds up to the balance of the
 * latest transaction, as every transaction is written from the balance
 * before it.
 */
export const lotsOf = (
  transactions: readonly DbPointTransaction[],
): PointLot[] => {
  const lots: PointLot[] = []
  for (const transaction of transactions) {
    if (transaction.points > 0) {
      lots.push({
        transaction,
        expiryDate: transaction.expiryDate,
        left: transaction.points,
      })
      continue
    }
    let taking = -transaction.points
    for (const lot of [...lots].sort(byExpiry)) {
      const taken = Math.min(lot.left, taking)
      lot.left -= taken
      taking -= taken
    }
  }
  return lots.filter(({ left }) => left > 0)
}

const pointsLeftIn = (lots: readonly PointLot[]): number =>
  lots.reduce((sum, { left }) => sum + left, 0)

/** The points of a customer whose expiry date is near. */
export type ExpiringPoints = {
  /** What is left of them. */
  expiringPoints: number
  /** The earliest of their expiry dates, or null when there are none. */
  expirationDate: string | null
  /** The earnings they are left of, by expiry date, then as written. */
  transactions: DbPointTransaction[]
}

/**
 * What is left of the earnings whose expiry date is `until` or earlier,
 * lapsed ones not yet expired included.
 */
export const expiringOf = (
  transactions: readonly DbPointTransaction[],
  until: string,
): ExpiringPoints => {
  const expiring = lotsOf(transactions)
    .filter(({ expiryDate }) => expiryDate !== null && expiryDate <= until)
    .sort(byExpiry)
  return {
    expiringPoints: pointsLeftIn(expiring),
    expirationDate: expiring[0]?.expiryDate ?? null,
    transactions: expiring.map(({ transaction }) => transaction),
  }
}

/**
 * The expiry a customer needs before `processBefore`:
 * - `planned`: the point transaction of the type `expired` that takes
 *   what is left of the earnings whose expiry date is before it
 * - `nothingLapsed`: no such earning has points left
 */
export type PointExpiryPlan =
  | { type: 'planned'; write: PointWrite }
  | { type: 'nothingLapsed' }

/**
 * Plans the expiry of the points of a customer from all their point
 * transactions, in the order they were written, and their balance. The
 * points an expiry takes are counted as taken, so a second plan with the
 * same `processBefore` finds nothing.
 */
export const planExpiry = (
  customerId: PointWrite['customerId'],
  balance: number,
  transactions: readonly DbPointTransaction[],
  processBefore: string,
): PointExpiryPlan => {
  const lapsed = pointsLeftIn(
    lotsOf(transactions).filter(
      ({ expiryDate }) => expiryDate !== null && expiryDate < processBefore,
    ),
  )
  if (lapsed === 0) {
    return { type: 'nothingLapsed' }
  }
  return {
    type: 'planned',
    write: {
      customerId,
      transactionType: 'expired',
      points: -lapsed,
      balance: balance - lapsed,
      description: null,
      referenceType: null,
      referenceId: null,
      expiryDate: null,
    },
  }
}
