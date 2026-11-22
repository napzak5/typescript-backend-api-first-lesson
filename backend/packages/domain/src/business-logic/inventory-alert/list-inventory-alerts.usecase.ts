import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { InventoryAlertReadMapper } from '../../mappers/read/inventory-alert.mapper'
import type { Actor } from '../../models/auth'
import type {
  ApiInventoryAlertResponse,
  DbInventoryAlertFacts,
} from '../../models/inventory-alert'
import type { ApiPaginationMeta } from '../../models/page'
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
  subjectIdOf,
} from './_shared/alerts'
import type { InventoryAlertUseCaseDependencies } from './_shared/dependencies'
import { unknownTimeZone } from './_shared/refusals'

const MESSAGE = 'Invalid inventory alert search'

const DEFAULT_LIMIT = 20

/** The facts of the first page, which begins nowhere in particular. */
type FirstFacts = {
  type: 'listed'
  facts: DbInventoryAlertFacts
  after: null
}

export type InventoryAlertPage = {
  data: ApiInventoryAlertResponse[]
  meta: ApiPaginationMeta
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
  ): Promise<Result<InventoryAlertPage, DomainError>> {
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
    const { cursor, salonId } = request.data
    if (!isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT
    const filter = {
      alert: request.data.alert ?? null,
      severity: request.data.severity ?? null,
      acknowledged: request.data.acknowledged ?? null,
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
      cursor === undefined
        ? Result.map(
            await inventoryAlertRepository.listFacts(criteria),
            (facts): InventoryAlertFactsAfter | FirstFacts => ({
              type: 'listed',
              facts,
              after: null,
            }),
          )
        : await inventoryAlertRepository.listFactsAfter(criteria, cursor)

    return Result.flatMap(listed, (listing) =>
      match(listing)
        .returnType<Result<InventoryAlertPage, DomainError>>()
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
        .with({ type: 'listed' }, ({ facts, after }) => {
          const alerts = alertsOf(facts, days).filter((alert) =>
            matchesFilter(alert, filter),
          )
          const page = pageOfAlerts(alerts, after, limit)
          const last = page.alerts.at(-1)

          return Result.map(
            InventoryAlertReadMapper.toApiInventoryAlerts(page.alerts),
            (data) => ({
              data,
              meta: {
                total: alerts.length,
                limit,
                hasMore: page.hasMore,
                cursor: cursor ?? null,
                nextCursor:
                  page.hasMore && last !== undefined ? subjectIdOf(last) : null,
                prevCursor: null,
              },
            }),
          )
        })
        .exhaustive(),
    )
  }
}
