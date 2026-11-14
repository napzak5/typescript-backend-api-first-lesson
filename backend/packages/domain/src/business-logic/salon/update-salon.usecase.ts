import { Result } from '@beauty-salon-backend/utility'
import { SalonReadMapper } from '../../mappers/read/salon.mapper'
import { SalonWriteMapper } from '../../mappers/write/salon.mapper'
import { type ApiSalonResponse, parseSalonId } from '../../models/salon'
import { salonUpdateRequestSchema } from '../../schemas/salon.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

export class UpdateSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. `openingHours`, when present, replaces the whole calendar.
   */
  async execute(
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiSalonResponse, DomainError>> {
    const salonId = parseSalonId(id)
    if (salonId.type === 'error') {
      return salonId
    }

    const request = parseWith(
      salonUpdateRequestSchema,
      input,
      'Invalid salon update',
    )
    if (request.type === 'error') {
      return request
    }

    const { changes, openingHours } = SalonWriteMapper.fromUpdateRequest(
      request.data,
    )
    const updated = await this.dependencies.salonRepository.update(
      salonId.data,
      changes,
      openingHours,
    )
    if (updated.type === 'error') {
      return updated
    }
    if (updated.data === null) {
      return Result.error(DomainErrors.notFound('Salon', salonId.data))
    }

    return SalonReadMapper.toApiSalon(
      updated.data.salon,
      updated.data.openingHours,
    )
  }
}
