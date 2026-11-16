import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import type { ApiPointExpireResponse } from '../../models/point'
import { pointExpireRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import { mayExpirePoints } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'
import { earliestExpiryDateOf, issuesOfProcessBefore } from './_shared/plan'

const MESSAGE = 'Invalid point expiry'

export class ExpirePointsUseCase {
  constructor(private readonly dependencies: PointUseCaseDependencies) {}

  /**
   * Expires what is left of the earnings whose expiry date is before
   * `processBefore` (yesterday in UTC when it is null), for one customer
   * or for every customer who is not deleted: one point transaction of the
   * type `expired` a customer who has such points. It is the
   * administrators' alone; anybody else is refused before the request is
   * looked at. A customer that is not there is a property of the request
   * that names no customer (400).
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiPointExpireResponse, DomainError>> {
    if (!mayExpirePoints(actor)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(pointExpireRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const now = this.dependencies.clock()
    const issues = issuesOfProcessBefore(request.data.processBefore, now)
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const expired = await this.dependencies.pointRepository.expire(
      request.data.customerId,
      request.data.processBefore ?? earliestExpiryDateOf(now),
    )
    if (expired.type === 'error') {
      return expired
    }

    return match(expired.data)
      .returnType<Result<ApiPointExpireResponse, DomainError>>()
      .with({ type: 'customerNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            notFound('customerId', 'a customer'),
          ]),
        ),
      )
      .with({ type: 'expired' }, ({ processedCount, totalPoints }) =>
        Result.success({ processedCount, totalPoints }),
      )
      .exhaustive()
  }
}
