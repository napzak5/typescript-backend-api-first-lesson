import { Result } from '@beauty-salon-backend/utility'
import { ProductReadMapper } from '../../mappers/read/product.mapper'
import type { Actor } from '../../models/auth'
import { type ApiProductResponse, parseProductId } from '../../models/product'
import { parseSalonIdOfPath } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayReadProducts } from './_shared/authorization'
import type { ProductUseCaseDependencies } from './_shared/dependencies'

export class GetProductUseCase {
  constructor(private readonly dependencies: ProductUseCaseDependencies) {}

  /**
   * One product of a salon, stocked or not. A product of another salon, and
   * one that was deleted, is answered like one that does not exist.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<ApiProductResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayReadProducts(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const productId = parseProductId(id)
    if (productId.type === 'error') {
      return productId
    }

    const { productRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const found = await productRepository.findById(salonId.data, productId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Product', productId.data))
    }

    return ProductReadMapper.toApiProduct(found.data)
  }
}
