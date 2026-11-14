import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { ServiceCategoryReadMapper } from '../../mappers/read/service-category.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import type { ApiServiceCategoryResponse } from '../../models/service-category'
import { serviceCategoryCreateRequestSchema } from '../../schemas/service-category.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayManageServiceCategories } from './_shared/authorization'
import type { ServiceCategoryUseCaseDependencies } from './_shared/dependencies'
import { parentNotFound } from './_shared/parent'

export class CreateServiceCategoryUseCase {
  constructor(
    private readonly dependencies: ServiceCategoryUseCaseDependencies,
  ) {}

  /**
   * Adds a category to the menu of a salon. Whether the actor may is decided
   * from the salon in the path alone, before the request is read and before
   * the salon is looked up. A parent must be a category of the same salon.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    input: unknown,
  ): Promise<Result<ApiServiceCategoryResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayManageServiceCategories(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      serviceCategoryCreateRequestSchema,
      input,
      'Invalid service category',
    )
    if (request.type === 'error') {
      return request
    }

    const { serviceCategoryRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const created = await serviceCategoryRepository.create(
      salonId.data,
      request.data,
    )
    if (created.type === 'error') {
      return created
    }

    return match(created.data)
      .returnType<Result<ApiServiceCategoryResponse, DomainError>>()
      .with({ type: 'created' }, ({ category }) =>
        ServiceCategoryReadMapper.toApiServiceCategory(category),
      )
      .with({ type: 'parentNotFound' }, () => Result.error(parentNotFound()))
      .exhaustive()
  }
}
