import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PurchaseOrderReadMapper } from '../../../mappers/read/purchase-order.mapper'
import type {
  ApiPurchaseOrderResponse,
  PurchaseOrderId,
} from '../../../models/purchase-order'
import type { PurchaseOrderChange } from '../../../repositories/purchase-order.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import { type OrderOperation, toStatusConflict } from './refusals'

/**
 * What an update, an approval or a cancellation of an order resolves to:
 * the order as it is now, none (404), or a conflict with where it stands
 * (409). `operation` is what was asked for.
 */
export const resultOfChange = (
  id: PurchaseOrderId,
  change: Result<PurchaseOrderChange, DomainError>,
  operation: OrderOperation,
): Result<ApiPurchaseOrderResponse, DomainError> =>
  Result.flatMap(change, (changed) =>
    match(changed)
      .returnType<Result<ApiPurchaseOrderResponse, DomainError>>()
      .with({ type: 'changed' }, ({ order }) =>
        PurchaseOrderReadMapper.toApiPurchaseOrder(order),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound(entityMessages.purchaseOrder, id)),
      )
      .with({ type: 'closed' }, { type: 'notFromStatus' }, (refusal) =>
        Result.error(toStatusConflict(id, refusal, operation)),
      )
      .exhaustive(),
  )
