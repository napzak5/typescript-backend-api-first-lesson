import { Result } from '@beauty-salon-backend/utility'
import { InventoryReportReadMapper } from '../../mappers/read/inventory-report.mapper'
import { InventoryReportWriteMapper } from '../../mappers/write/inventory-report.mapper'
import type { Actor } from '../../models/auth'
import type { ApiInventoryValueReportResponse } from '../../models/inventory'
import { inventoryValueReportRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryKeeperReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { salonNotFound } from './_shared/refusals'

const MESSAGE = 'Invalid inventory value report'

export class GetInventoryValueReportUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * What the stock of a salon is worth at its purchase prices, by the
   * category of its products. The figure is the keepers': whether the actor
   * keeps stock is decided before the query is looked at, and whether they
   * keep that of the salon it names before the salon is looked up.
   */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<ApiInventoryValueReportResponse, DomainError>> {
    const reach = inventoryKeeperReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(inventoryValueReportRequestSchema, query, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { salonId, category } =
      InventoryReportWriteMapper.fromValueReportRequest(request.data)
    if (!isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const { inventoryRepository, salonRepository } = this.dependencies
    const salonExists = await salonRepository.exists(salonId)
    if (salonExists.type === 'error') {
      return salonExists
    }
    if (!salonExists.data) {
      return Result.error(salonNotFound(MESSAGE))
    }

    const categories = await inventoryRepository.valueReport(salonId, category)

    return Result.flatMap(categories, (rows) =>
      InventoryReportReadMapper.toApiValueReport(salonId, rows),
    )
  }
}
