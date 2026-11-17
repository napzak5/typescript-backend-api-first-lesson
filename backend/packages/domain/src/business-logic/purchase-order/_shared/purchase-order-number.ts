import { recordNumberFrom } from '../../_shared/record-number'

/** A purchase order number, `PO-XXXX-XXXX`, from whoever picks its symbols. */
export const purchaseOrderNumberFrom = (
  pick: (count: number) => number,
): string => recordNumberFrom('PO', pick)
