import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  productMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { type ProductId, parseProductId } from '../../models/product'
import { parseSalonIdOfPath } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepProducts } from './_shared/authorization'
import type { ProductUseCaseDependencies } from './_shared/dependencies'

export class DeleteProductUseCase {
  constructor(private readonly dependencies: ProductUseCaseDependencies) {}

  /**
   * Takes a product out of those a salon keeps. The row stays, for the
   * sales, the stock movements and the treatments that name it, and the
   * code of the product is free for another. A product with stock rows
   * stays: its stock is deleted first, or it is set to not active instead.
   * Resolves to the ID of the deleted product.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<ProductId, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayKeepProducts(actor, salonId.data)) {
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

    const removed = await productRepository.delete(salonId.data, productId.data)
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<ProductId, DomainError>>()
      .with({ type: 'deleted' }, () => productId)
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.product, productId.data),
        ),
      )
      .with({ type: 'inStock' }, () =>
        Result.error(DomainErrors.conflict(productMessages.hasStock)),
      )
      .exhaustive()
  }
}
