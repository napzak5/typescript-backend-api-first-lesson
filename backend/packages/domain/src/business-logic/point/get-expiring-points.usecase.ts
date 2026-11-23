import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  pointMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { PointReadMapper } from '../../mappers/read/point.mapper'
import { PointWriteMapper } from '../../mappers/write/point.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiPointExpiringResponse } from '../../models/point'
import { pointExpiringSearchRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { pointReachOf } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'
import { expiringOf } from './_shared/lots'
import { expiringUntilOf } from './_shared/plan'

const MESSAGE = pointMessages.invalidExpiringPointsSearch

export class GetExpiringPointsUseCase {
  constructor(private readonly dependencies: PointUseCaseDependencies) {}

  /**
   * What is left of the earnings of a customer whose expiry date is at
   * most `days` days after today (UTC), lapsed ones not yet expired
   * included, and the earnings themselves, the earliest expiry date first.
   *
   * Whether the actor keeps the points ledger is decided before the
   * request is looked at, which is why the query arrives as the caller
   * decoded it.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPointExpiringResponse, DomainError>> {
    if (pointReachOf(actor) === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const id = parseCustomerId(customerId)
    if (id.type === 'error') {
      return id
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      pointExpiringSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { days } = PointWriteMapper.fromExpiringSearchRequest(request.data)
    const until = expiringUntilOf(this.dependencies.clock(), days)

    const found = await this.dependencies.pointRepository.transactionsOf(
      id.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.customer, id.data),
      )
    }

    return PointReadMapper.toApiExpiringPoints(
      id.data,
      expiringOf(found.data, until),
    )
  }
}
