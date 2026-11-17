import { randomInt } from 'node:crypto'
import {
  type IPurchaseOrderNumberIssuer,
  purchaseOrderNumberFrom,
} from '@beauty-salon-backend/domain'

/**
 * Purchase order numbers whose symbols the system's CSPRNG picks, each of
 * them equally likely: a number says nothing about how many orders a salon
 * places or which one was drafted before it.
 */
export class RandomPurchaseOrderNumberIssuer
  implements IPurchaseOrderNumberIssuer
{
  issue(): string {
    return purchaseOrderNumberFrom((count) => randomInt(count))
  }
}
