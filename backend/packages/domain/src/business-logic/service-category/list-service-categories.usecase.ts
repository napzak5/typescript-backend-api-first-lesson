import { Result } from '@beauty-salon-backend/utility'
import { ServiceCategoryReadMapper } from '../../mappers/read/service-category.mapper'
import { type ApiPaginationMeta, parseSalonIdOfPath } from '../../models/salon'
import type { ApiServiceCategoryResponse } from '../../models/service-category'
import { serviceCategorySearchRequestSchema } from '../../schemas/service-category.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import type { ServiceCategoryUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid service category search'

export type ServiceCategoryPage = {
  data: ApiServiceCategoryResponse[]
  meta: ApiPaginationMeta
}

export class ListServiceCategoriesUseCase {
  constructor(
    private readonly dependencies: ServiceCategoryUseCaseDependencies,
  ) {}

  /**
   * Lists the categories of a salon in the order in which a menu shows
   * them. The cursor of a page is the ID of its last category. A category
   * that was deleted since is gone, and a cursor that names it is refused:
   * the list has to be read from the start again.
   */
  async execute(
    salon: unknown,
    input: unknown,
  ): Promise<Result<ServiceCategoryPage, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    const request = parseWith(
      serviceCategorySearchRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { cursor, isActive } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const { serviceCategoryRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await serviceCategoryRepository.list({
      salonId: salonId.data,
      limit,
      after: cursor ?? null,
      isActive: isActive ?? null,
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
            message: 'The category this cursor names is not there any more',
          },
        ]),
      )
    }

    const { categories, total, hasMore } = listed.data
    const lastCategoryId = categories.at(-1)?.id ?? null

    return Result.map(
      ServiceCategoryReadMapper.toApiServiceCategories(categories),
      (data) => ({
        data,
        meta: {
          total,
          limit,
          hasMore,
          cursor: cursor ?? null,
          nextCursor: hasMore ? lastCategoryId : null,
          // Pages are only walked forwards.
          prevCursor: null,
        },
      }),
    )
  }
}
