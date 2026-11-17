import type { InventoryTransactionType } from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'

/**
 * What a stock movement is held to by its kind. A movement is one change
 * of the stock of one stock row; moving stock between rows (between
 * storage places or salons) is two movements, out of the one row and into
 * the other.
 */

/** Which way a kind of movement moves the stock. */
export type Direction = 'in' | 'out' | 'either'

/**
 * A purchase brings stock in; a sale, a use in a treatment and a disposal
 * take it out. An adjustment puts the stock on paper right either way, a
 * return goes back to the supplier or comes back from a customer, and a
 * transfer leaves one row and comes into another.
 */
export const directionOf = (type: InventoryTransactionType): Direction =>
  match(type)
    .returnType<Direction>()
    .with('purchase', () => 'in')
    .with('sale', 'use', 'disposal', () => 'out')
    .with('adjustment', 'return', 'transfer', () => 'either')
    .exhaustive()

/**
 * Whether a kind of movement states why. An adjustment changes the stock
 * without anything having been seen to move, and a disposal takes stock
 * off for good; whoever counts the stock next has to be able to tell why.
 */
export const needsReason = (type: InventoryTransactionType): boolean =>
  match(type)
    .with('adjustment', 'disposal', () => true)
    .with('purchase', 'sale', 'use', 'return', 'transfer', () => false)
    .exhaustive()

/**
 * Whether a kind of movement is only the keepers' (the owner's and the
 * managers') to record. The staff record what moves day to day: what is
 * bought in, sold, used in a treatment and returned. Changing the stock on
 * paper, taking it off the books and moving it between rows are the
 * keepers'.
 */
export const isKeepersMovement = (type: InventoryTransactionType): boolean =>
  match(type)
    .with('adjustment', 'disposal', 'transfer', () => true)
    .with('purchase', 'sale', 'use', 'return', () => false)
    .exhaustive()

/**
 * The total cost of a movement in yen: the unit cost times the quantity
 * moved, either way, rounded half away from zero as PostgreSQL rounds a
 * `numeric`. The unit cost is a whole number of yen and the quantity has
 * at most two decimals; both are counted exactly, the quantity in
 * hundredths.
 */
export const totalCostOf = (unitCost: number, quantity: number): bigint => {
  const hundredths = BigInt(Math.round(Math.abs(quantity) * 100))
  return (BigInt(unitCost) * hundredths + 50n) / 100n
}

/**
 * The largest unit cost whose total cost for the quantity is at most the
 * limit.
 */
export const largestUnitCostOf = (quantity: number, limit: number): bigint => {
  const hundredths = BigInt(Math.round(Math.abs(quantity) * 100))
  // round(u × h / 100) ≤ limit ⇔ u × h + 50 < (limit + 1) × 100
  return ((BigInt(limit) + 1n) * 100n - 51n) / hundredths
}
