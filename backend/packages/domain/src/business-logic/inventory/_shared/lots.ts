import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { inventoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'

/**
 * A product kept by lots (`requiresLotTracking`) has a stock row for each
 * lot, and each row names its lot. A product that is not has one stock row
 * at a salon, which names no lot: the rows of a salon and a product differ
 * by their lot numbers alone.
 *
 * Why the lot number of a row does not fit its product; null when it does.
 */
export const lotNumberRefusal = (
  requiresLotTracking: boolean,
  lotNumber: string | null,
): LocalizedText | null =>
  match({ requiresLotTracking, lotNumber })
    .returnType<LocalizedText | null>()
    .with(
      { requiresLotTracking: true, lotNumber: null },
      () => inventoryMessages.lotOfProductKeptByLots,
    )
    .with(
      { requiresLotTracking: false, lotNumber: P.string },
      () => inventoryMessages.nullForProductNotKeptByLots,
    )
    .with(
      { requiresLotTracking: true, lotNumber: P.string },
      { requiresLotTracking: false, lotNumber: null },
      () => null,
    )
    .exhaustive()
