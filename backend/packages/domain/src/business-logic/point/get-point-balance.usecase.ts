import { Result } from '@beauty-salon-backend/utility'
import { PointReadMapper } from '../../mappers/read/point.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiPointBalanceResponse } from '../../models/point'
import { type DomainError, DomainErrors } from '../../shared'
import { pointReachOf } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'

export class GetPointBalanceUseCase {
  constructor(private readonly dependencies: PointUseCaseDependencies) {}

  /**
   * The balance of a customer: their `loyaltyPoints`, which is the balance
   * of their latest point transaction, and 0 when they have none. Whether
   * the actor keeps the points ledger is decided before the ID is looked
   * at.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
  ): Promise<Result<ApiPointBalanceResponse, DomainError>> {
    if (pointReachOf(actor) === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const id = parseCustomerId(customerId)
    if (id.type === 'error') {
      return id
    }

    const balance = await this.dependencies.pointRepository.balanceOf(id.data)
    if (balance.type === 'error') {
      return balance
    }
    if (balance.data === null) {
      return Result.error(DomainErrors.notFound('Customer', id.data))
    }

    return Result.success(
      PointReadMapper.toApiPointBalance(id.data, balance.data),
    )
  }
}
