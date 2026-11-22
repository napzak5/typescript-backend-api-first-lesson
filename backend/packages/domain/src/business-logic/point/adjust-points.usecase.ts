import { Result } from '@beauty-salon-backend/utility'
import { PointWriteMapper } from '../../mappers/write/point.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPointTransactionResponse } from '../../models/point'
import { pointAdjustRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { pointAdjustReachOf } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'
import { recordMovement } from './_shared/record'

const MESSAGE = 'Invalid point adjustment'

export class AdjustPointsUseCase {
  constructor(private readonly dependencies: PointUseCaseDependencies) {}

  /**
   * Moves points of a customer by hand, either way, as a point transaction
   * of the type `adjusted`: to put right what was earned or used wrongly,
   * or what a void sale gave. It is not the staff's; an actor who adjusts
   * no points is refused before the request is looked at.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiPointTransactionResponse, DomainError>> {
    const reach = pointAdjustReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(pointAdjustRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    return recordMovement(
      this.dependencies,
      reach,
      PointWriteMapper.fromAdjustRequest(request.data),
      MESSAGE,
    )
  }
}
