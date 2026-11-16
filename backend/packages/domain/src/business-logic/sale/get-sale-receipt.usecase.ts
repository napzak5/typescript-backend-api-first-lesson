import { Result } from '@beauty-salon-backend/utility'
import { SaleReadMapper } from '../../mappers/read/sale.mapper'
import type { Actor } from '../../models/auth'
import { type ApiSaleReceiptResponse, parseSaleId } from '../../models/sale'
import { type DomainError, DomainErrors } from '../../shared'
import { saleReachOf } from './_shared/authorization'
import type { SaleUseCaseDependencies } from './_shared/dependencies'
import { refusalOfReceipt } from './_shared/receipt'
import { toReceiptRefusalError } from './_shared/refusals'

export class GetSaleReceiptUseCase {
  constructor(private readonly dependencies: SaleUseCaseDependencies) {}

  /**
   * Makes the receipt of a sale that was paid (`refusalOfReceipt`): the
   * sale as it is read, numbered with the number of the sale and dated
   * with the moment it is made. Nothing is written, so a receipt that is
   * asked for again is the same but for that moment. Whether the actor
   * keeps a sales ledger is decided before the ID is looked at, and a sale
   * of another salon is answered like one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiSaleReceiptResponse, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const saleId = parseSaleId(id)
    if (saleId.type === 'error') {
      return saleId
    }

    const { saleRepository, clock } = this.dependencies
    const found = await saleRepository.findById(saleId.data, reach)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Sale', saleId.data))
    }

    const refusal = refusalOfReceipt(found.data)
    if (refusal !== null) {
      return Result.error(toReceiptRefusalError(refusal))
    }

    return Result.map(SaleReadMapper.toApiSale(found.data), (sale) => ({
      receiptNumber: sale.saleNumber,
      sale,
      issuedAt: clock().toISOString(),
    }))
  }
}
