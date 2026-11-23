import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { SaleReadMapper } from '../../mappers/read/sale.mapper'
import type { Actor } from '../../models/auth'
import { type ApiSaleResponse, parseSaleId } from '../../models/sale'
import { type DomainError, DomainErrors } from '../../shared'
import { saleReachOf } from './_shared/authorization'
import type { SaleUseCaseDependencies } from './_shared/dependencies'

export class GetSaleUseCase {
  constructor(private readonly dependencies: SaleUseCaseDependencies) {}

  /**
   * Returns a sale with its lines and its payments. Whether the actor
   * keeps a sales ledger is decided before the ID is looked at. A sale of
   * another salon than the actor's is answered like one that does not
   * exist: the answer does not tell that the ID is a sale.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiSaleResponse, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const saleId = parseSaleId(id)
    if (saleId.type === 'error') {
      return saleId
    }

    const found = await this.dependencies.saleRepository.findById(
      saleId.data,
      reach,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(DomainErrors.notFound(entityMessages.sale, saleId.data))
      : SaleReadMapper.toApiSale(found.data)
  }
}
