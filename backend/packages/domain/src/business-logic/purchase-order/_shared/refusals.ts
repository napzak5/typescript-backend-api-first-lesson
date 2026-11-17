import { match } from 'ts-pattern'
import type { PurchaseOrderId } from '../../../models/purchase-order'
import { type DomainError, DomainErrors } from '../../../shared'
import type { OrderStatusRefusal } from './status'

/**
 * Why where an order stands does not take the operation, as the conflict
 * it is: the request is fine, the order has moved on. `takes` says which
 * orders the operation takes.
 */
export const toStatusConflict = (
  id: PurchaseOrderId,
  refusal: OrderStatusRefusal,
  takes: string,
): DomainError =>
  DomainErrors.conflict(
    match(refusal)
      .with(
        { type: 'closed' },
        ({ status }) =>
          `Purchase order ${id} is ${status}: a delivered or cancelled order does not change`,
      )
      .with(
        { type: 'notFromStatus' },
        ({ status }) => `Purchase order ${id} is ${status}: ${takes}`,
      )
      .exhaustive(),
  )
