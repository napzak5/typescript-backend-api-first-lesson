import type { ISaleRepository } from '../../../repositories/sale.repository'
import type { ISaleNumberIssuer } from '../../../services/sale-number-issuer'

/** Everything the sale use cases need from the outside. */
export interface SaleUseCaseDependencies {
  saleRepository: ISaleRepository
  saleNumberIssuer: ISaleNumberIssuer
  /** The moment a receipt is made. */
  clock: () => Date
}
