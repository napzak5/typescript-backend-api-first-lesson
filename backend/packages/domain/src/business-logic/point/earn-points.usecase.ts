import { Result } from '@beauty-salon-backend/utility'
import { PointWriteMapper } from '../../mappers/write/point.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPointTransactionResponse } from '../../models/point'
import { pointEarnRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { pointReachOf } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'
import { issuesOfExpiry } from './_shared/plan'
import { recordMovement } from './_shared/record'

const MESSAGE = 'Invalid point earning'

export class EarnPointsUseCase {
  constructor(private readonly dependencies: PointUseCaseDependencies) {}

  /**
   * Gives a customer points, as a point transaction of the type `earned`,
   * and adds them to the balance. Earning is the work of the till, the
   * staff of a salon included; an actor who keeps no points ledger is
   * refused before the request is looked at.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiPointTransactionResponse, DomainError>> {
    const reach = pointReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(pointEarnRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const earning = PointWriteMapper.fromEarnRequest(request.data)
    const issues = issuesOfExpiry(
      earning.request.expiryDate,
      this.dependencies.clock(),
    )
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    return recordMovement(this.dependencies, reach, earning, MESSAGE)
  }
}
