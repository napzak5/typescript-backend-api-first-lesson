import type { Result } from '@beauty-salon-backend/utility'
import { SalonReadMapper } from '../../mappers/read/salon.mapper'
import { SalonWriteMapper } from '../../mappers/write/salon.mapper'
import type { ApiSalonResponse } from '../../models/salon'
import { salonCreateRequestSchema } from '../../schemas/salon.schema'
import { type DomainError, parseWith } from '../../shared'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

export class CreateSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Validate → map API to DB → save → map DB to API. A second salon with the
   * same email is rejected by the unique constraint, which the repository
   * reports as `alreadyExists`.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiSalonResponse, DomainError>> {
    const request = parseWith(salonCreateRequestSchema, input, 'Invalid salon')
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
