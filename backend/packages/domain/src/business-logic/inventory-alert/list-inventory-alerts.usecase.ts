import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { InventoryAlertReadMapper } from '../../mappers/read/inventory-alert.mapper'
import { InventoryAlertWriteMapper } from '../../mappers/write/inventory-alert.mapper'
import type { Actor } from '../../models/auth'
import type {
  ApiInventoryAlertResponse,
  DbInventoryAlertFacts,
} from '../../models/inventory-alert'
import type { ApiPage } from '../../models/page'
import type { InventoryAlertFactsAfter } from '../../repositories/inventory-alert.repository'
import { inventoryAlertSearchRequestSchema } from '../../schemas/inventory-alert.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryReachOf } from '../inventory/_shared/authorization'
import { salonNotFound } from '../inventory/_shared/refusals'
import {
  alertDaysOf,
  alertsOf,
  matchesFilter,
  pageOfAlerts,
} from './_shared/alerts'
import type { InventoryAlertUseCaseDependencies } from './_shared/dependencies'
import { unknownTimeZone } from './_shared/refusals'

const MESSAGE = 'Invalid inventory alert search'

/** The facts of the first page, which begins nowhere in particular. */
type FirstFacts = {
  type: 'listed'
  facts: DbInventoryAlertFacts
  after: null
}

export class ListInventoryAlertsUseCase {
  constructor(
    private readonly dependencies: InventoryAlertUseCaseDependencies,
  ) {}

  /**
   * Lists the alerts of the stock of a salon as they are now, each with the
   * acknowledgement that still holds for it, narrowed by type, severity and
   * whether it is acknowledged. By the codes of the products, the alert of
   * a product before those of its stock rows. The cursor of a page is what
   * the last alert of the page before is about, its stock row or its
   * product; the page goes on after where that alert stands, whether it is
   * still there or not, and a cursor that names nothing of the salon is
   * refused.
   *
   * Whether the actor reads stock is decided before the query is looked at,
   * which is why it arrives as the caller decoded it, and whether for the
   * salon of the query before the salon is looked up.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiInventoryAlertResponse>, DomainError>> {
    const reach = inventoryReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      inventoryAlertSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { salonId, filter, ...paging } =
      InventoryAlertWriteMapper.fromSearchRequest(request.data)
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

    const criteria = { salonId, lastExpiringDay: days.lastExpiringDay }
    const listed =
      paging.after === null
        ? Result.map(
            await inventoryAlertRepository.listFacts(criteria),
            (facts): InventoryAlertFactsAfter | FirstFacts => ({
              type: 'listed',
              facts,
              after: null,
            }),
          )
        : await inventoryAlertRepository.listFactsAfter(criteria, paging.after)

    return Result.flatMap(listed, (listing) =>
      match(listing)
        .returnType<Result<ApiPage<ApiInventoryAlertResponse>, DomainError>>()
        .with({ type: 'cursorNotFound' }, () =>
          Result.error(
            DomainErrors.validation(MESSAGE, [
              {
                field: 'cursor',
                rule: 'not_found',
                message: 'Must name a product or a stock row of the salon',
              },
            ]),
          ),
        )
        .with({ type: 'listed' }, ({ facts, after }) =>
          InventoryAlertReadMapper.toApiInventoryAlertPage(
            pageOfAlerts(
              alertsOf(facts, days).filter((alert) =>
                matchesFilter(alert, filter),
              ),
              after,
              paging.limit,
            ),
            paging,
          ),
        )
        .exhaustive(),
    )
  }
}
