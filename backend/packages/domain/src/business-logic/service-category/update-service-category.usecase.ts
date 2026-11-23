import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  serviceCategoryMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { ServiceCategoryReadMapper } from '../../mappers/read/service-category.mapper'
import { ServiceCategoryWriteMapper } from '../../mappers/write/service-category.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import {
  type ApiServiceCategoryResponse,
  parseCategoryId,
} from '../../models/service-category'
import { serviceCategoryUpdateRequestSchema } from '../../schemas/service-category.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayManageServiceCategories } from './_shared/authorization'
import type { ServiceCategoryUseCaseDependencies } from './_shared/dependencies'
import { parentNotFound, parentWithinSubtree } from './_shared/parent'

export class UpdateServiceCategoryUseCase {
  constructor(
    private readonly dependencies: ServiceCategoryUseCaseDependencies,
  ) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. Whether the actor may is decided from the salon in the path
   * alone, before the request is read and before anything is looked up. A
   * new parent must be a category of the same salon, and neither the
   * category itself nor one below it.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiServiceCategoryResponse, DomainError>> {
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

    const request = parseWith(
      serviceCategoryUpdateRequestSchema,
      input,
      serviceCategoryMessages.invalidServiceCategoryUpdate,
    )
    if (request.type === 'error') {
      return request
    }

    const { serviceCategoryRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const updated = await serviceCategoryRepository.update(
      salonId.data,
      categoryId.data,
      ServiceCategoryWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiServiceCategoryResponse, DomainError>>()
      .with({ type: 'updated' }, ({ category }) =>
        ServiceCategoryReadMapper.toApiServiceCategory(category),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.notFound(
            entityMessages.serviceCategory,
            categoryId.data,
          ),
        ),
      )
      .with({ type: 'parentNotFound' }, () => Result.error(parentNotFound()))
      .with({ type: 'parentWithinSubtree' }, () =>
        Result.error(parentWithinSubtree()),
      )
      .exhaustive()
  }
}
