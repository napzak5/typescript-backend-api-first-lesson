import { Result } from '@beauty-salon-backend/utility'
import { customerStatisticsMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerStatisticsReadMapper } from '../../mappers/read/customer-statistics.mapper'
import { CustomerStatisticsWriteMapper } from '../../mappers/write/customer-statistics.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerStatisticsResponse } from '../../models/customer-statistics'
import { customerStatisticsGetRequestSchema } from '../../schemas/customer-statistics.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { notFound } from '../booking/_shared/plan'
import { saleReachOf } from '../sale/_shared/authorization'
import type { CustomerStatisticsUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = customerStatisticsMessages.invalidCustomerStatistics

export class GetCustomerStatisticsUseCase {
  constructor(
    private readonly dependencies: CustomerStatisticsUseCaseDependencies,
  ) {}

  /**
   * The statistics of a customer at a salon in a period (`toApiStatistics`).
   * They show what the customer spent at the salon, so they are read by
   * those who keep its sales ledger (`saleReachOf`): whether the actor
   * keeps one at all is decided before the ID and the query are read, and
   * whether they keep that of the salon the query names, once it says
   * which salon that is. A salon that is not there is a fault of the
   * query; a customer that is not there, or was deleted, is not found.
   */
  async execute(
    actor: Actor,
    id: unknown,
    query: unknown,
  ): Promise<Result<ApiCustomerStatisticsResponse, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }
    const request = parseWith(
      customerStatisticsGetRequestSchema,
      query,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const period = CustomerStatisticsWriteMapper.fromGetRequest(request.data)
    if (!isWithin(reach, period.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const found =
      await this.dependencies.customerStatisticsRepository.findStatistics(
        customerId.data,
        period,
      )
    if (found.type === 'error') {
      return found
    }

    return match(found.data)
      .returnType<Result<ApiCustomerStatisticsResponse, DomainError>>()
      .with({ type: 'salonNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [notFound('salonId', 'a salon')]),
        ),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', customerId.data)),
      )
      .with({ type: 'found' }, ({ figures }) =>
        CustomerStatisticsReadMapper.toApiStatistics(
          customerId.data,
          period,
          figures,
        ),
      )
      .exhaustive()
  }
}
