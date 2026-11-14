import { Result } from '@beauty-salon-backend/utility'
import { ServiceCategoryReadMapper } from '../../mappers/read/service-category.mapper'
import { parseSalonIdOfPath } from '../../models/salon'
import {
  type ApiServiceCategoryResponse,
  parseCategoryId,
} from '../../models/service-category'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import type { ServiceCategoryUseCaseDependencies } from './_shared/dependencies'

export class GetServiceCategoryUseCase {
  constructor(
    private readonly dependencies: ServiceCategoryUseCaseDependencies,
  ) {}

  /**
   * One category of a salon. A category of another salon is answered like
   * one that does not exist.
   */
  async execute(
    salon: unknown,
    id: unknown,
  ): Promise<Result<ApiServiceCategoryResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    const categoryId = parseCategoryId(id)
    if (categoryId.type === 'error') {
      return categoryId
    }

    const { serviceCategoryRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const found = await serviceCategoryRepository.findById(
      salonId.data,
      categoryId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound('Service category', categoryId.data),
      )
    }

    return ServiceCategoryReadMapper.toApiServiceCategory(found.data)
  }
}
