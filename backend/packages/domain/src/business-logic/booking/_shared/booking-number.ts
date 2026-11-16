import { recordNumberFrom } from '../../_shared/record-number'

/** A booking number, `BK-XXXX-XXXX`, from whoever picks its symbols. */
export const bookingNumberFrom = (pick: (count: number) => number): string =>
  recordNumberFrom('BK', pick)
