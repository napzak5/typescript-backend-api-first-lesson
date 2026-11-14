import { Result } from '@beauty-salon-backend/utility'
import { SalonReadMapper } from '../../mappers/read/salon.mapper'
import { type ApiSalonResponse, parseSalonId } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

export class GetSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  async execute(id: unknown): Promise<Result<ApiSalonResponse, DomainError>> {
    const salonId = parseSalonId(id)
    if (salonId.type === 'error') {
      return salonId
    }

    const found = await this.dependencies.salonRepository.findById(salonId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Salon', salonId.data))
    }

    return SalonReadMapper.toApiSalon(found.data.salon, found.data.openingHours)
  }
}
