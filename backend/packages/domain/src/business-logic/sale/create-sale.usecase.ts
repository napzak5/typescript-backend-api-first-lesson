import { Result } from '@beauty-salon-backend/utility'
import { saleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { SaleReadMapper } from '../../mappers/read/sale.mapper'
import { SaleWriteMapper } from '../../mappers/write/sale.mapper'
import type { Actor } from '../../models/auth'
import type { ApiSaleResponse } from '../../models/sale'
import { saleCreateRequestSchema } from '../../schemas/sale.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { underFreeNumber } from '../_shared/numbered'
import { isWithin } from '../booking/_shared/authorization'
import { saleReachOf } from './_shared/authorization'
import type { SaleUseCaseDependencies } from './_shared/dependencies'
import { toRefusalError } from './_shared/refusals'

const MESSAGE = saleMessages.invalidSale

export class CreateSaleUseCase {
  constructor(private readonly dependencies: SaleUseCaseDependencies) {}

  /**
   * Enters the bill of one visit into the sales ledger of a salon. Whether
   * the actor keeps a sales ledger at all is decided before the request is
   * read, and whether it is the ledger of the salon the request names,
   * once the request says which salon that is.
   *
   * A sale is what the till charged, so the request is held to what keeps
   * the ledger sound: every line agrees with itself, everything the sale
   * names is there and of that salon, and a booking is billed once. What a
   * service or a product costs by its own record is not compared with the
   * line.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiSaleResponse, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(saleCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const requested = SaleWriteMapper.fromCreateRequest(request.data)
    if (!isWithin(reach, requested.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const { saleRepository, saleNumberIssuer } = this.dependencies

    return underFreeNumber('sale', saleNumberIssuer, async (saleNumber) => {
      const created = await saleRepository.create(requested, { saleNumber })
      if (created.type === 'error') {
        return created
      }

      return match(created.data)
        .returnType<Result<ApiSaleResponse, DomainError> | null>()
        .with({ type: 'created' }, ({ sale }) => SaleReadMapper.toApiSale(sale))
        .with({ type: 'saleNumberTaken' }, () => null)
        .with(
          { type: P.not(P.union('created', 'saleNumberTaken')) },
          (refusal) => Result.error(toRefusalError(refusal, MESSAGE)),
        )
        .exhaustive()
    })
  }
}
