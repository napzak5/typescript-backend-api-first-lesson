import { purchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { PurchaseOrderId } from '../../../models/purchase-order'
import { type DomainError, DomainErrors } from '../../../shared'
import type { OrderStatusRefusal } from './status'

/** What was asked of an order, as a refusal names it. */
export type OrderOperation = Parameters<
  typeof purchaseOrderMessages.notFromStatus
>[2]

/**
 * Why where an order stands does not take the operation, as the conflict
 * it is: the request is fine, the order has moved on. The refusal says
 * which orders the `operation` takes.
 */
export const toStatusConflict = (
  id: PurchaseOrderId,
  refusal: OrderStatusRefusal,
  operation: OrderOperation,
): DomainError =>
  DomainErrors.conflict(
    match(refusal)
      .with({ type: 'closed' }, ({ status }) =>
        purchaseOrderMessages.closed(id, status),
      )
      .with({ type: 'notFromStatus' }, ({ status }) =>
        purchaseOrderMessages.notFromStatus(id, status, operation),
      )
      .exhaustive(),
  )
