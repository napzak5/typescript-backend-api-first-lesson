import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { ProductReadMapper } from '../../mappers/read/product.mapper'
import { ProductWriteMapper } from '../../mappers/write/product.mapper'
import type { Actor } from '../../models/auth'
import { type ApiProductResponse, parseProductId } from '../../models/product'
import { parseSalonIdOfPath } from '../../models/salon'
import { productUpdateRequestSchema } from '../../schemas/product.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayKeepProducts } from './_shared/authorization'
import type { ProductUseCaseDependencies } from './_shared/dependencies'
import { stockLevelIssues } from './_shared/stock-levels'

const MESSAGE = 'Invalid product update'

export class UpdateProductUseCase {
  constructor(private readonly dependencies: ProductUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. Whether the actor may is decided from the salon in the path
   * alone, before the request is read and before anything is looked up.
   *
   * The salon of a product is not among what a request can name. The stock
   * levels are held to their order as they are after the change: a level
   * the request names is checked against the others as they are stored.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiProductResponse, DomainError>> {
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

    const request = parseWith(productUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const changes = ProductWriteMapper.fromUpdateRequest(request.data)

    const { productRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const updated = await productRepository.update(
      salonId.data,
      productId.data,
      changes,
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiProductResponse, DomainError>>()
      .with({ type: 'updated' }, ({ product }) =>
        ProductReadMapper.toApiProduct(product),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Product', productId.data)),
      )
      .with({ type: 'stockLevelsOutOfOrder' }, ({ broken }) =>
        Result.error(
          DomainErrors.validation(
            MESSAGE,
            stockLevelIssues(
              broken,
              (level) => changes[level] !== undefined,
            ).map(({ field, message }) => ({
              field,
              rule: 'custom',
              message,
            })),
          ),
        ),
      )
      .exhaustive()
  }
}
