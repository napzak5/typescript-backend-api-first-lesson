import { Result } from '@beauty-salon-backend/utility'
import { inventoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { InventoryReportReadMapper } from '../../mappers/read/inventory-report.mapper'
import { InventoryReportWriteMapper } from '../../mappers/write/inventory-report.mapper'
import type { Actor } from '../../models/auth'
import type { ApiInventoryStockCountResponse } from '../../models/inventory'
import { inventoryStockCountRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { notFound } from '../booking/_shared/plan'
import { inventoryKeeperReachOf, performerOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { salonNotFound } from './_shared/refusals'

const MESSAGE = inventoryMessages.invalidStockCount

export class PerformStockCountUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Sets the stock of the rows of a salon to what was counted of them. A
   * row that differs gets an adjustment of the difference; every row has
   * the count written on it. The rows are counted all or none: a row that
   * is not of the salon, or a count below what is reserved of a row,
   * refuses the whole count.
   *
   * A count adjusts the stock, which is the keepers' to do: whether the
   * actor keeps stock is decided before the request is looked at, and
   * whether they keep that of the salon it names before the salon is looked
   * up. A row of another salon is a row the count names wrongly (400), as
   * one that is not there is.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiInventoryStockCountResponse, DomainError>> {
    const reach = inventoryKeeperReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(inventoryStockCountRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const count = InventoryReportWriteMapper.fromStockCountRequest(
      request.data,
      performerOf(actor),
    )
    if (!isWithin(reach, count.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const { inventoryRepository, salonRepository } = this.dependencies
    const salonExists = await salonRepository.exists(count.salonId)
    if (salonExists.type === 'error') {
      return salonExists
    }
    if (!salonExists.data) {
      return Result.error(salonNotFound(MESSAGE))
    }

    const counted = await inventoryRepository.performStockCount(count)
    if (counted.type === 'error') {
      return counted
    }

    return match(counted.data)
      .returnType<Result<ApiInventoryStockCountResponse, DomainError>>()
      .with({ type: 'counted' }, ({ adjustments, discrepancies }) =>
        InventoryReportReadMapper.toApiStockCount(adjustments, discrepancies),
      )
      .with({ type: 'rowsNotFound' }, ({ indexes }) =>
        Result.error(
          DomainErrors.validation(
            MESSAGE,
            indexes.map((index) =>
              notFound(
                `items.${index}.inventoryId`,
                'a stock row of the salon',
              ),
            ),
          ),
        ),
      )
      .with({ type: 'belowReserved' }, ({ inventoryId }) =>
        Result.error(
          DomainErrors.conflict(
            `What was counted of stock row ${inventoryId} is below its reserved stock`,
          ),
        ),
      )
      .exhaustive()
  }
}
