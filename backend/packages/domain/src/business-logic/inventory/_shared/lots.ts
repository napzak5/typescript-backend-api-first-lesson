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
): string | null =>
  match({ requiresLotTracking, lotNumber })
    .returnType<string | null>()
    .with(
      { requiresLotTracking: true, lotNumber: null },
      () => 'Must name the lot: the product is kept by lots',
    )
    .with(
      { requiresLotTracking: false, lotNumber: P.string },
      () => 'Must be null: the product is not kept by lots',
    )
    .with(
      { requiresLotTracking: true, lotNumber: P.string },
      { requiresLotTracking: false, lotNumber: null },
      () => null,
    )
    .exhaustive()
