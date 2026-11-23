import { Result } from '@beauty-salon-backend/utility'
import { serviceCategoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { ServiceCategoryReadMapper } from '../../mappers/read/service-category.mapper'
import { ServiceCategoryWriteMapper } from '../../mappers/write/service-category.mapper'
import type { ApiPage } from '../../models/page'
import { parseSalonIdOfPath } from '../../models/salon'
import type { ApiServiceCategoryResponse } from '../../models/service-category'
import { serviceCategorySearchRequestSchema } from '../../schemas/service-category.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import type { ServiceCategoryUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = serviceCategoryMessages.invalidServiceCategorySearch

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
  ): Promise<Result<ApiPage<ApiServiceCategoryResponse>, DomainError>> {
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
    const criteria = ServiceCategoryWriteMapper.fromSearchRequest(
      request.data,
      salonId.data,
    )

    const { serviceCategoryRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await serviceCategoryRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: serviceCategoryMessages.categoryOfCursorGone,
          },
        ]),
      )
    }

    return ServiceCategoryReadMapper.toApiServiceCategoryPage(
      listed.data,
      criteria,
    )
  }
}
