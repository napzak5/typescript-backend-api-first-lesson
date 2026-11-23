import { Result } from '@beauty-salon-backend/utility'
import { productMessages } from '@beauty-salon-shared/i18n/messages/api'
import { ProductReadMapper } from '../../mappers/read/product.mapper'
import { ProductWriteMapper } from '../../mappers/write/product.mapper'
import type { Actor } from '../../models/auth'
import type { ApiProductResponse } from '../../models/product'
import { parseSalonIdOfPath } from '../../models/salon'
import { productCreateRequestSchema } from '../../schemas/product.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepProducts } from './_shared/authorization'
import type { ProductUseCaseDependencies } from './_shared/dependencies'

export class CreateProductUseCase {
  constructor(private readonly dependencies: ProductUseCaseDependencies) {}

  /**
   * Adds a product to those a salon keeps. Whether the actor may is decided
   * from the salon in the path alone, before the request is read and before
   * the salon is looked up. The product has no stock: stock is recorded for
   * it apart from it.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    input: unknown,
  ): Promise<Result<ApiProductResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayKeepProducts(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      productCreateRequestSchema,
      input,
      productMessages.invalidProduct,
    )
    if (request.type === 'error') {
      return request
    }

    const { productRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const created = await productRepository.create(
      salonId.data,
      ProductWriteMapper.fromCreateRequest(request.data),
    )

    return Result.flatMap(created, ProductReadMapper.toApiProduct)
  }
}
