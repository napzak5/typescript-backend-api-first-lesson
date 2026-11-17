import type { DbPointTransaction, PointWrite } from '../../../models/point'
import { MAX_INTEGER } from '../../../schemas/rules'
import { lotsOf } from './lots'

/**
 * The transfer of the points of a customer who is merged into another:
 * - `planned`: `from` takes the balance of the customer merged to 0 and is
 *   null when they have no points; `to` adds to the customer kept what is
 *   left of each increase of the other's balance, in the order the
 *   increases were written, each with its expiry date, so that the points
 *   expire as they would have
 * - `beyondLimit`: the balance of the customer kept would go above the
 *   largest one a balance may have
 */
export type PointTransferPlan =
  | { type: 'planned'; from: PointWrite | null; to: PointWrite[] }
  | { type: 'beyondLimit' }

/** The two customers of a transfer, with their balances. */
export type PointTransferParties = {
  /** The customer merged into the other, who gives their points. */
  from: { customerId: string; balance: number }
  /** The customer kept, who takes them. */
  to: { customerId: string; balance: number }
}

/**
 * Plans the transfer of the points of `from` to `to` from all the point
 * transactions of `from`, in the order they were written. Each write names
 * the other customer as its reference.
 */
export const planTransfer = (
  { from, to }: PointTransferParties,
  transactions: readonly DbPointTransaction[],
): PointTransferPlan => {
  const lots = lotsOf(transactions)
  const moved = lots.reduce((sum, { left }) => sum + left, 0)
  if (moved === 0) {
    return { type: 'planned', from: null, to: [] }
  }
  if (to.balance + moved > MAX_INTEGER) {
    return { type: 'beyondLimit' }
  }

  let balance = to.balance
  return {
    type: 'planned',
    from: {
      customerId: from.customerId,
      transactionType: 'transferred',
      points: -moved,
      balance: from.balance - moved,
      description: null,
      referenceType: 'customer',
      referenceId: to.customerId,
      expiryDate: null,
    },
    to: lots.map(({ left, expiryDate }) => {
      balance += left
      return {
        customerId: to.customerId,
        transactionType: 'transferred',
        points: left,
        balance,
        description: null,
        referenceType: 'customer',
        referenceId: from.customerId,
        expiryDate,
      }
    }),
  }
}
