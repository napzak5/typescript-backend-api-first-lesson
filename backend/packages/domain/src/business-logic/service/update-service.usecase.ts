import { Result } from '@beauty-salon-backend/utility'
import { serviceMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { ServiceReadMapper } from '../../mappers/read/service.mapper'
import { ServiceWriteMapper } from '../../mappers/write/service.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { type ApiServiceResponse, parseServiceId } from '../../models/service'
import { serviceUpdateRequestSchema } from '../../schemas/service.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayManageServices } from './_shared/authorization'
import type { ServiceUseCaseDependencies } from './_shared/dependencies'
import {
  invalidService,
  packageContainsItself,
  toRefusalError,
} from './_shared/refusals'

const MESSAGE = serviceMessages.invalidServiceUpdate

export class UpdateServiceUseCase {
  constructor(private readonly dependencies: ServiceUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are; options, when present, replace the options of the service.
   * Whether the actor may is decided from the salon in the path alone,
   * before the request is read and before anything is looked up. The rules
   * that tie properties together hold for the service as it is afterwards.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiServiceResponse, DomainError>> {
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

    const request = parseWith(serviceUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { changes, options } = ServiceWriteMapper.fromUpdateRequest(
      request.data,
    )
    if (changes.packageServiceIds?.includes(serviceId.data)) {
      return Result.error(invalidService(MESSAGE, [packageContainsItself]))
    }

    const { serviceRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const updated = await serviceRepository.update(
      salonId.data,
      serviceId.data,
      changes,
      options,
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiServiceResponse, DomainError>>()
      .with({ type: 'updated' }, ({ service }) =>
        ServiceReadMapper.toApiService(service.service, service.options),
      )
      .with({ type: P.not('updated') }, (refusal) =>
        Result.error(toRefusalError(refusal, MESSAGE)),
      )
      .exhaustive()
  }
}
