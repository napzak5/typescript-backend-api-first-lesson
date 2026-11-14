import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseServiceId, type ServiceId } from '../../models/service'
import { type DomainError, DomainErrors } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayManageServices } from './_shared/authorization'
import type { ServiceUseCaseDependencies } from './_shared/dependencies'

export class DeleteServiceUseCase {
  constructor(private readonly dependencies: ServiceUseCaseDependencies) {}

  /**
   * Takes a service off the menu of a salon; its row stays, marked as
   * deleted. Whether the actor may is decided from the salon in the path
   * alone, before anything is looked up. A service that a package contains
   * stays until it has left the package.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
  ): Promise<Result<ServiceId, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayManageServices(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
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

    const deleted = await serviceRepository.delete(salonId.data, serviceId.data)
    if (deleted.type === 'error') {
      return deleted
    }

    return match(deleted.data)
      .returnType<Result<ServiceId, DomainError>>()
      .with({ type: 'deleted' }, () => serviceId)
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Service', serviceId.data)),
      )
      .with({ type: 'containedInPackage' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The service is part of a package and has to leave it first',
          ),
        ),
      )
      .exhaustive()
  }
}
