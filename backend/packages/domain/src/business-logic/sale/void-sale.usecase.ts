import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { SaleReadMapper } from '../../mappers/read/sale.mapper'
import type { Actor } from '../../models/auth'
import { type ApiSaleResponse, parseSaleId } from '../../models/sale'
import { saleVoidRequestSchema } from '../../schemas/sale.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { saleVoidReachOf } from './_shared/authorization'
import type { SaleUseCaseDependencies } from './_shared/dependencies'
import { toVoidRefusalError } from './_shared/refusals'

/**
 * Voids a sale: it stays in the ledger as a sale that was taken back, with
 * the time and the reason, and its booking can be billed again. Within a
 * salon the owner and the managers void a sale. An actor who voids none is
 * refused before the request is looked at; a sale of another salon is one
 * that does not exist.
 */
export class VoidSaleUseCase {
  constructor(private readonly dependencies: SaleUseCaseDependencies) {}

  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiSaleResponse, DomainError>> {
    const reach = saleVoidReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const saleId = parseSaleId(id)
    if (saleId.type === 'error') {
      return saleId
    }
    const request = parseWith(saleVoidRequestSchema, input, 'Invalid sale void')
    if (request.type === 'error') {
      return request
    }

    const voided = await this.dependencies.saleRepository.voidSale(
      saleId.data,
      reach,
      request.data,
    )
    if (voided.type === 'error') {
      return voided
    }

    return match(voided.data)
      .returnType<Result<ApiSaleResponse, DomainError>>()
      .with({ type: 'voided' }, ({ sale }) => SaleReadMapper.toApiSale(sale))
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Sale', saleId.data)),
      )
      .with({ type: 'void' }, { type: 'paid' }, (refusal) =>
        Result.error(toVoidRefusalError(refusal)),
      )
      .exhaustive()
  }
}
