import { Result } from '@beauty-salon-backend/utility'
import { serviceMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import { ServiceReadMapper } from '../../mappers/read/service.mapper'
import { ServiceWriteMapper } from '../../mappers/write/service.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import type { ApiServiceBulkUpdateResponse } from '../../models/service'
import { serviceBulkUpdateRequestSchema } from '../../schemas/service.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayManageServices } from './_shared/authorization'
import type { ServiceUseCaseDependencies } from './_shared/dependencies'
import {
  invalidService,
  packageContainsItself,
  toRefusalError,
} from './_shared/refusals'

const MESSAGE = serviceMessages.invalidServiceBulkUpdate

/** The property of the request that holds the changes. */
const UPDATES = 'updates'

export class BulkUpdateServicesUseCase {
  constructor(private readonly dependencies: ServiceUseCaseDependencies) {}

  /**
   * Applies the same changes to several services of a salon, to all of them
   * or to none. Whether the actor may is decided from the salon in the path
   * alone, before the request is read and before anything is looked up. The
   * rules that tie properties together hold for every service as it is
   * afterwards.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    input: unknown,
  ): Promise<Result<ApiServiceBulkUpdateResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayManageServices(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(serviceBulkUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { serviceIds, changes, options } =
      ServiceWriteMapper.fromBulkUpdateRequest(request.data)
    if (serviceIds.some((id) => changes.packageServiceIds?.includes(id))) {
      return Result.error(
        invalidService(MESSAGE, [packageContainsItself], UPDATES),
      )
    }

    const { serviceRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const updated = await serviceRepository.updateMany(
      salonId.data,
      serviceIds,
      changes,
      options,
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiServiceBulkUpdateResponse, DomainError>>()
      .with({ type: 'updated' }, () =>
        Result.success(ServiceReadMapper.toApiServiceBulkUpdate(serviceIds)),
      )
      .with({ type: P.not('updated') }, (refusal) =>
        Result.error(toRefusalError(refusal, MESSAGE, UPDATES)),
      )
      .exhaustive()
  }
}
