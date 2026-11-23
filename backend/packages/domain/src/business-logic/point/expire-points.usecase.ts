import { Result } from '@beauty-salon-backend/utility'
import {
  pointMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PointReadMapper } from '../../mappers/read/point.mapper'
import { PointWriteMapper } from '../../mappers/write/point.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPointExpireResponse } from '../../models/point'
import { pointExpireRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import { mayExpirePoints } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'
import { earliestExpiryDateOf, issuesOfProcessBefore } from './_shared/plan'

const MESSAGE = pointMessages.invalidPointExpiry

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
    const { customerId, processBefore } = PointWriteMapper.fromExpireRequest(
      request.data,
    )
    const now = this.dependencies.clock()
    const issues = issuesOfProcessBefore(processBefore, now)
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const expired = await this.dependencies.pointRepository.expire(
      customerId,
      processBefore ?? earliestExpiryDateOf(now),
    )
    if (expired.type === 'error') {
      return expired
    }

    return match(expired.data)
      .returnType<Result<ApiPointExpireResponse, DomainError>>()
      .with({ type: 'customerNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            notFound('customerId', ruleMessages.aCustomer),
          ]),
        ),
      )
      .with({ type: 'expired' }, (outcome) =>
        Result.success(PointReadMapper.toApiPointExpiry(outcome)),
      )
      .exhaustive()
  }
}
