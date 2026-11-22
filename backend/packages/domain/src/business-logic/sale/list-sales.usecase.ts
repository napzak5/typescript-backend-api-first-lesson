import { Result } from '@beauty-salon-backend/utility'
import { SaleReadMapper } from '../../mappers/read/sale.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPaginationMeta } from '../../models/page'
import type { ApiSaleResponse } from '../../models/sale'
import { saleSearchRequestSchema } from '../../schemas/sale.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { saleReachOf } from './_shared/authorization'
import type { SaleUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid sale search'

export type SalePage = {
  data: ApiSaleResponse[]
  meta: ApiPaginationMeta
}

export class ListSalesUseCase {
  constructor(private readonly dependencies: SaleUseCaseDependencies) {}

  /**
   * Lists the sales the actor reaches by the time of the sale, latest
   * first: the ledger is read from today backwards. Sales that are void
   * are listed with the others. The cursor of a page is the ID of its last
   * sale, and one that names no sale the actor reaches is refused.
   *
   * Whether the actor keeps a sales ledger is decided before the request
   * is looked at, which is why the query arrives as the caller decoded it.
   * A member of a salon is listed the sales of that salon and is refused
   * when the query names another; an administrator is listed those of
   * every salon, or of the one the query names.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<SalePage, DomainError>> {
    const reach = saleReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(saleSearchRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const {
      cursor,
      salonId,
      customerId,
      bookingId,
      paymentStatus,
      startDate,
      endDate,
    } = request.data
    if (salonId !== undefined && !isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.saleRepository.list({
      reach,
      limit,
      after: cursor ?? null,
      salonId: salonId ?? null,
      customerId: customerId ?? null,
      bookingId: bookingId ?? null,
      paymentStatus: paymentStatus ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a sale',
          },
        ]),
      )
    }

    const { sales, total, hasMore } = listed.data
    const lastSaleId = sales.at(-1)?.sale.id ?? null

    return Result.map(SaleReadMapper.toApiSales(sales), (data) => ({
      data,
      meta: {
        total,
        limit,
        hasMore,
        cursor: cursor ?? null,
        nextCursor: hasMore ? lastSaleId : null,
        // Pages are only walked forwards.
        prevCursor: null,
      },
    }))
  }
}
