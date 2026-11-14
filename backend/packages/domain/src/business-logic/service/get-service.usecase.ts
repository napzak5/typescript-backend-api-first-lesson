import { Result } from '@beauty-salon-backend/utility'
import { ServiceReadMapper } from '../../mappers/read/service.mapper'
import { parseSalonIdOfPath } from '../../models/salon'
import { type ApiServiceResponse, parseServiceId } from '../../models/service'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import type { ServiceUseCaseDependencies } from './_shared/dependencies'

export class GetServiceUseCase {
  constructor(private readonly dependencies: ServiceUseCaseDependencies) {}

  /**
   * One service of a salon, with its options. A service of another salon
   * and a deleted one are answered like one that does not exist.
   */
  async execute(
    salon: unknown,
    id: unknown,
  ): Promise<Result<ApiServiceResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    const serviceId = parseServiceId(id)
    if (serviceId.type === 'error') {
      return serviceId
    }

    const { serviceRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const found = await serviceRepository.findById(salonId.data, serviceId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Service', serviceId.data))
    }

    return ServiceReadMapper.toApiService(
      found.data.service,
      found.data.options,
    )
  }
}
