import { Result } from '@beauty-salon-backend/utility'
import { SalonReadMapper } from '../../mappers/read/salon.mapper'
import type { ApiPaginationMeta, ApiSalonResponse } from '../../models/salon'
import { salonSearchRequestSchema } from '../../schemas/salon.schema'
import { type DomainError, parseWith } from '../../shared'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20

export type SalonPage = {
  data: ApiSalonResponse[]
  meta: ApiPaginationMeta
}

export class ListSalonsUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Lists salons newest first. The cursor of a page is the ID of its last
   * salon, so a page stays stable while salons are added or removed.
   */
  async execute(input: unknown): Promise<Result<SalonPage, DomainError>> {
    const request = parseWith(
      salonSearchRequestSchema,
      input,
      'Invalid salon search',
    )
    if (request.type === 'error') {
      return request
    }

    const { cursor, keyword, prefecture, city, isActive, minRating, features } =
      request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.salonRepository.list({
      limit,
      after: cursor ?? null,
      keyword: keyword ?? null,
      prefecture: prefecture ?? null,
      city: city ?? null,
      isActive: isActive ?? null,
      minRating: minRating ?? null,
      features: features ?? [],
    })
    if (listed.type === 'error') {
      return listed
    }

    const { salons, total, hasMore } = listed.data
    const lastSalonId = salons.at(-1)?.salon.id ?? null

    return Result.map(SalonReadMapper.toApiSalons(salons), (data) => ({
      data,
      meta: {
        total,
        limit,
        hasMore,
        cursor: cursor ?? null,
        nextCursor: hasMore ? lastSalonId : null,
        // Pages are only walked forwards.
        prevCursor: null,
      },
    }))
  }
}
