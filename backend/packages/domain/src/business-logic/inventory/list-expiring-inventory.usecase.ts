import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { inventoryExpiringSearchRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { EXPIRING_SOON_DAYS, lastExpiringDayOf } from './_shared/expiry'
import { DEFAULT_LIMIT, type InventoryPage, pageOf } from './_shared/page'
import { salonNotFound } from './_shared/refusals'

const MESSAGE = 'Invalid expiring search'

export class ListExpiringInventoryUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Lists the stock rows of a salon that expire within the days of the
   * query, counted from today as the salon's clocks tell it, both ends
   * included, and those that have expired: what to use first or to throw
   * away. A row without stock has nothing to use or throw away and is not
   * listed, nor is one without an expiry date. Earliest expiry first.
   *
   * Whether the actor reads stock is decided before the query is looked at,
   * and whether they read that of the salon of the query before the salon is
   * looked up.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<InventoryPage, DomainError>> {
    const reach = inventoryReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(
      inventoryExpiringSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { cursor, salonId } = request.data
    if (!isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT
    const days = request.data.days ?? EXPIRING_SOON_DAYS

    const { inventoryRepository, salonRepository, clock } = this.dependencies
    const found = await salonRepository.findById(salonId)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(salonNotFound(MESSAGE))
    }
    const { timezone } = found.data.salon
    const until = lastExpiringDayOf(clock(), timezone, days)
    if (until === null) {
      // The API takes only time zones the runtime knows.
      return Result.error(
        DomainErrors.database(
          `Stored salon ${salonId} has a time zone the runtime does not know`,
          timezone,
        ),
      )
    }

    const listed = await inventoryRepository.listExpiring({
      salonId,
      limit,
      after: cursor ?? null,
      until,
    })

    return Result.flatMap(listed, (rows) =>
      pageOf(rows, { limit, cursor: cursor ?? null }, MESSAGE),
    )
  }
}
