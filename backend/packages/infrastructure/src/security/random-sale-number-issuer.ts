import { randomInt } from 'node:crypto'
import {
  type ISaleNumberIssuer,
  saleNumberFrom,
} from '@beauty-salon-backend/domain'

/**
 * Sale numbers whose symbols the system's CSPRNG picks, each of them
 * equally likely: a number says nothing about how many sales a salon has
 * or which one was entered before it.
 */
export class RandomSaleNumberIssuer implements ISaleNumberIssuer {
  issue(): string {
    return saleNumberFrom((count) => randomInt(count))
  }
}
