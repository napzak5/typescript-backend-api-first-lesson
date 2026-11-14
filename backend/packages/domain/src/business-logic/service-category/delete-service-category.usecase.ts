import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { type CategoryId, parseCategoryId } from '../../models/service-category'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayManageServiceCategories } from './_shared/authorization'
import type { ServiceCategoryUseCaseDependencies } from './_shared/dependencies'

export class DeleteServiceCategoryUseCase {
  constructor(
    private readonly dependencies: ServiceCategoryUseCaseDependencies,
  ) {}

  /**
   * Removes a category from the menu of a salon. Its subcategories become
   * top-level categories and its services lose their category; neither is
   * removed. Resolves to the ID of the deleted category.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<CategoryId, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayManageServiceCategories(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
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

    const deleted = await serviceCategoryRepository.delete(
      salonId.data,
      categoryId.data,
    )
    if (deleted.type === 'error') {
      return deleted
    }
    if (!deleted.data) {
      return Result.error(
        DomainErrors.notFound('Service category', categoryId.data),
      )
    }

    return categoryId
  }
}
