import { recordNumberFrom } from '../../_shared/record-number'

/** A sale number, `SL-XXXX-XXXX`, from whoever picks its symbols. */
export const saleNumberFrom = (pick: (count: number) => number): string =>
  recordNumberFrom('SL', pick)
