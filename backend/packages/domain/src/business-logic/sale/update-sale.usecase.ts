import { Result } from '@beauty-salon-backend/utility'
import { saleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { SaleReadMapper } from '../../mappers/read/sale.mapper'
import { SaleWriteMapper } from '../../mappers/write/sale.mapper'
import type { Actor } from '../../models/auth'
import { type ApiSaleResponse, parseSaleId } from '../../models/sale'
import { saleUpdateRequestSchema } from '../../schemas/sale.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { saleReachOf } from './_shared/authorization'
import type { SaleUseCaseDependencies } from './_shared/dependencies'
import { toChangeRefusalError, toRefusalError } from './_shared/refusals'

const MESSAGE = saleMessages.invalidSaleUpdate

/**
 * Corrects a sale: the properties the request names are written, and lines
 * that are named take the place of every line the sale has. Whoever keeps
 * the ledger corrects it. An actor who reaches no sale is refused before
 * the request is looked at; a sale of another salon is one that does not
 * exist.
 */
export class UpdateSaleUseCase {
  constructor(private readonly dependencies: SaleUseCaseDependencies) {}

  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiSaleResponse, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const saleId = parseSaleId(id)
    if (saleId.type === 'error') {
      return saleId
    }
    const request = parseWith(saleUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const updated = await this.dependencies.saleRepository.update(
      saleId.data,
      reach,
      SaleWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiSaleResponse, DomainError>>()
      .with({ type: 'updated' }, ({ sale }) => SaleReadMapper.toApiSale(sale))
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Sale', saleId.data)),
      )
      .with({ type: 'void' }, { type: 'paymentBegun' }, (refusal) =>
        Result.error(toChangeRefusalError(refusal)),
      )
      .with(
        { type: 'invalid' },
        { type: 'timeZoneUnknown' },
        { type: 'bookingBilled' },
        (refusal) => Result.error(toRefusalError(refusal, MESSAGE)),
      )
      .exhaustive()
  }
}
