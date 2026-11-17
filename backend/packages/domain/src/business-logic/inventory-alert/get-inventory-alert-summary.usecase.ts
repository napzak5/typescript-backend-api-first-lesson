import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import type { ApiInventoryAlertSummaryResponse } from '../../models/inventory-alert'
import { inventoryAlertSummaryRequestSchema } from '../../schemas/inventory-alert.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryReachOf } from '../inventory/_shared/authorization'
import { salonNotFound } from '../inventory/_shared/refusals'
import { alertDaysOf, alertsOf, summaryOf } from './_shared/alerts'
import type { InventoryAlertUseCaseDependencies } from './_shared/dependencies'
import { unknownTimeZone } from './_shared/refusals'

const MESSAGE = 'Invalid inventory alert summary request'

export class GetInventoryAlertSummaryUseCase {
  constructor(
    private readonly dependencies: InventoryAlertUseCaseDependencies,
  ) {}

  /**
   * Counts the alerts of the stock of a salon as they are now: all of them,
   * those of each severity, and those that no acknowledgement holds for.
   * The alerts are those the list shows, read in one snapshot.
   *
   * Whether the actor reads stock is decided before the query is looked at,
   * and whether for the salon of the query before the salon is looked up.
   */
  async execute(
    actor: Actor,
    query: unknown,
  ): Promise<Result<ApiInventoryAlertSummaryResponse, DomainError>> {
    const reach = inventoryReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(
      inventoryAlertSummaryRequestSchema,
      query,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { salonId } = request.data
    if (!isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const { inventoryAlertRepository, salonRepository, clock } =
      this.dependencies
    const found = await salonRepository.findById(salonId)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(salonNotFound(MESSAGE))
    }
    const { timezone } = found.data.salon
    const days = alertDaysOf(clock(), timezone)
    if (days === null) {
      return Result.error(unknownTimeZone(salonId, timezone))
    }

    const listed = await inventoryAlertRepository.listFacts({
      salonId,
      lastExpiringDay: days.lastExpiringDay,
    })

    return Result.map(listed, (facts) => summaryOf(alertsOf(facts, days)))
  }
}
