import { recordNumberFrom } from '../../_shared/record-number'

/** The number of a payment, `PT-XXXX-XXXX`, from whoever picks its symbols. */
export const paymentNumberFrom = (pick: (count: number) => number): string =>
  recordNumberFrom('PT', pick)
