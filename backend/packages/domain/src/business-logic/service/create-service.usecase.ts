import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'
import { ServiceReadMapper } from '../../mappers/read/service.mapper'
import { ServiceWriteMapper } from '../../mappers/write/service.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import type { ApiServiceResponse } from '../../models/service'
import { serviceCreateRequestSchema } from '../../schemas/service.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayManageServices } from './_shared/authorization'
import type { ServiceUseCaseDependencies } from './_shared/dependencies'
import { invalidService, toRefusalError } from './_shared/refusals'
import { serviceRuleIssues } from './_shared/rules'

const MESSAGE = 'Invalid service'

export class CreateServiceUseCase {
  constructor(private readonly dependencies: ServiceUseCaseDependencies) {}

  /**
   * Adds a service, with its options, to the menu of a salon. Whether the
   * actor may is decided from the salon in the path alone, before the
   * request is read and before the salon is looked up. A category must be
   * one of the same salon, and a package combines services of the same
   * salon that are not packages themselves.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    input: unknown,
  ): Promise<Result<ApiServiceResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayManageServices(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(serviceCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { service, options } = ServiceWriteMapper.fromCreateRequest(
      request.data,
    )
    const issues = serviceRuleIssues(service)
    if (issues.length > 0) {
      return Result.error(invalidService(MESSAGE, issues))
    }

    const { serviceRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const created = await serviceRepository.create(
      salonId.data,
      service,
      options,
    )
    if (created.type === 'error') {
      return created
    }

    return match(created.data)
      .returnType<Result<ApiServiceResponse, DomainError>>()
      .with({ type: 'created' }, ({ service: stored }) =>
        ServiceReadMapper.toApiService(stored.service, stored.options),
      )
      .with(
        {
          type: P.union(
            'categoryNotFound',
            'packageMemberNotFound',
            'packageMemberIsPackage',
          ),
        },
        (refusal) => Result.error(toRefusalError(refusal, MESSAGE)),
      )
      .exhaustive()
  }
}
