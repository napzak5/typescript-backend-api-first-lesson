import type { IProductRepository } from '../../../repositories/product.repository'
import type { ISalonRepository } from '../../../repositories/salon.repository'

/** Everything the product use cases need from the outside. */
export interface ProductUseCaseDependencies {
  productRepository: IProductRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
}
