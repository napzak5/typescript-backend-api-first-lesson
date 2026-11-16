import { randomInt } from 'node:crypto'
import {
  type IPaymentNumberIssuer,
  paymentNumberFrom,
} from '@beauty-salon-backend/domain'

/**
 * Payment numbers whose symbols the system's CSPRNG picks, each of them
 * equally likely: a number says nothing about how many payments a salon
 * took or which one was recorded before it.
 */
export class RandomPaymentNumberIssuer implements IPaymentNumberIssuer {
  issue(): string {
    return paymentNumberFrom((count) => randomInt(count))
  }
}
