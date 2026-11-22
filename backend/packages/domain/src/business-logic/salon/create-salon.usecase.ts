import { Result } from '@beauty-salon-backend/utility'
import { salonMessages } from '@beauty-salon-shared/i18n/messages/api'
import { SalonReadMapper } from '../../mappers/read/salon.mapper'
import { SalonWriteMapper } from '../../mappers/write/salon.mapper'
import type { Actor } from '../../models/auth'
import type { ApiSalonResponse } from '../../models/salon'
import { salonCreateRequestSchema } from '../../schemas/salon.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayCreateSalon } from './_shared/authorization'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

export class CreateSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Authorize → validate → map API to DB → save → map DB to API. A second salon with the
   * same email is rejected by the unique index, which the repository reports
   * as `alreadyExists`. The index leaves out deleted salons, so their email
   * can be used again.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiSalonResponse, DomainError>> {
    if (!mayCreateSalon(actor)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      salonCreateRequestSchema,
      input,
      salonMessages.invalidSalon,
    )
    if (request.type === 'error') {
      return request
    }

    const { salon, openingHours } = SalonWriteMapper.fromCreateRequest(
      request.data,
    )
    const created = await this.dependencies.salonRepository.create(
      salon,
      openingHours,
    )
    if (created.type === 'error') {
      return created
    }

    return SalonReadMapper.toApiSalon(
      created.data.salon,
      created.data.openingHours,
    )
  }
}
