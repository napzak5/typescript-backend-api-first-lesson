import { Result } from '@beauty-salon-backend/utility'
import { parseSalonId, type SalonId } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

export class DeleteSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Marks the salon as deleted; its row and calendar are kept. Resolves to
   * the ID of the deleted salon.
   */
  async execute(id: unknown): Promise<Result<SalonId, DomainError>> {
    const salonId = parseSalonId(id)
    if (salonId.type === 'error') {
      return salonId
    }

    const deleted = await this.dependencies.salonRepository.delete(salonId.data)
    if (deleted.type === 'error') {
      return deleted
    }
    if (!deleted.data) {
      return Result.error(DomainErrors.notFound('Salon', salonId.data))
    }

    return salonId
  }
}
