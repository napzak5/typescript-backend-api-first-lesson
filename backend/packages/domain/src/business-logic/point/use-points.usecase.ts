import { Result } from '@beauty-salon-backend/utility'
import { PointWriteMapper } from '../../mappers/write/point.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPointTransactionResponse } from '../../models/point'
import { pointUseRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { pointReachOf } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'
import { recordMovement } from './_shared/record'

const MESSAGE = 'Invalid point use'

export class UsePointsUseCase {
  constructor(private readonly dependencies: PointUseCaseDependencies) {}

  /**
   * Takes points of a customer, as a point transaction of the type `used`
   * whose points are negative, and takes them from the balance. Using is
   * the work of the till, the staff of a salon included; an actor who keeps
   * no points ledger is refused before the request is looked at.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiPointTransactionResponse, DomainError>> {
    const reach = pointReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(pointUseRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    return recordMovement(
      this.dependencies,
      reach,
      PointWriteMapper.fromUseRequest(request.data),
      MESSAGE,
    )
  }
}
