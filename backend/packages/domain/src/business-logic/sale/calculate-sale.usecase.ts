import { Result } from '@beauty-salon-backend/utility'
import { saleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { SaleReadMapper } from '../../mappers/read/sale.mapper'
import { SaleWriteMapper } from '../../mappers/write/sale.mapper'
import type { Actor } from '../../models/auth'
import type { ApiSaleCalculateResponse } from '../../models/sale'
import { saleCalculateRequestSchema } from '../../schemas/sale.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { saleReachOf } from './_shared/authorization'
import { planCalculation } from './_shared/calculation'
import type { SaleUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = saleMessages.invalidCalculation

export class CalculateSaleUseCase {
  constructor(private readonly dependencies: SaleUseCaseDependencies) {}

  /**
   * Tells what a sale would come to before the till enters it
   * (`planCalculation`). Whether the actor keeps a sales ledger at all is
   * decided before the request is read, and whether it is the ledger of
   * the salon the request names, once the request says which salon that
   * is, as for the entry of a sale. Nothing is written.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiSaleCalculateResponse, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(saleCalculateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const requested = SaleWriteMapper.fromCalculateRequest(request.data)
    if (!isWithin(reach, requested.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const references =
      await this.dependencies.saleRepository.findCalculationReferences(
        requested,
      )
    if (references.type === 'error') {
      return references
    }

    return match(planCalculation(requested, references.data))
      .returnType<Result<ApiSaleCalculateResponse, DomainError>>()
      .with({ type: 'calculated' }, ({ calculation }) =>
        Result.success(SaleReadMapper.toApiSaleCalculation(calculation)),
      )
      .with({ type: 'invalid' }, ({ issues }) =>
        Result.error(DomainErrors.validation(MESSAGE, issues)),
      )
      .exhaustive()
  }
}
