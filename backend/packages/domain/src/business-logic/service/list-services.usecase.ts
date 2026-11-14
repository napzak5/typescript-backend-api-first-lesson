import { Result } from '@beauty-salon-backend/utility'
import { ServiceReadMapper } from '../../mappers/read/service.mapper'
import { type ApiPaginationMeta, parseSalonIdOfPath } from '../../models/salon'
import type { ApiServiceResponse } from '../../models/service'
import { serviceSearchRequestSchema } from '../../schemas/service.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import type { ServiceUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid service search'

export type ServicePage = {
  data: ApiServiceResponse[]
  meta: ApiPaginationMeta
}

export class ListServicesUseCase {
  constructor(private readonly dependencies: ServiceUseCaseDependencies) {}

  /**
   * Lists the services of a salon in the order in which a menu shows them,
   * without the deleted ones. The cursor of a page is the ID of its last
   * service; a deleted service still says where the next page begins, and
   * only a cursor that names no service of the salon is refused.
   */
  async execute(
    salon: unknown,
    input: unknown,
  ): Promise<Result<ServicePage, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    const request = parseWith(serviceSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { cursor, categoryId, isActive } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const { serviceRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await serviceRepository.list({
      salonId: salonId.data,
      limit,
      after: cursor ?? null,
      categoryId: categoryId ?? null,
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
            message: 'Must name a service of the salon',
          },
        ]),
      )
    }

    const { services, total, hasMore } = listed.data
    const lastServiceId = services.at(-1)?.service.id ?? null

    return Result.map(ServiceReadMapper.toApiServices(services), (data) => ({
      data,
      meta: {
        total,
        limit,
        hasMore,
        cursor: cursor ?? null,
        nextCursor: hasMore ? lastServiceId : null,
        // Pages are only walked forwards.
        prevCursor: null,
      },
    }))
  }
}
