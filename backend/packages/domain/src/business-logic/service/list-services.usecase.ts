import { Result } from '@beauty-salon-backend/utility'
import {
  ruleMessages,
  serviceMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { ServiceReadMapper } from '../../mappers/read/service.mapper'
import { ServiceWriteMapper } from '../../mappers/write/service.mapper'
import type { ApiPage } from '../../models/page'
import { parseSalonIdOfPath } from '../../models/salon'
import type { ApiServiceResponse } from '../../models/service'
import { serviceSearchRequestSchema } from '../../schemas/service.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import type { ServiceUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = serviceMessages.invalidServiceSearch

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
  ): Promise<Result<ApiPage<ApiServiceResponse>, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    const request = parseWith(serviceSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const criteria = ServiceWriteMapper.fromSearchRequest(
      request.data,
      salonId.data,
    )

    const { serviceRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await serviceRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: ruleMessages.aServiceOfSalon,
          },
        ]),
      )
    }

    return ServiceReadMapper.toApiServicePage(listed.data, criteria)
  }
}
