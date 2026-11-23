import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { SalonId } from '../../models/salon'
import type { ISalonRepository } from '../../repositories/salon.repository'
import { type DomainError, DomainErrors } from '../../shared'

/**
 * What belongs to a salon is reached through the salon: without the salon
 * there is nothing to find or to add to. Resolves to `notFound` when the
 * salon does not exist; a deleted salon does not.
 */
export const requireSalon = async (
  salonRepository: ISalonRepository,
  salonId: SalonId,
): Promise<Result<null, DomainError>> => {
  const exists = await salonRepository.exists(salonId)
  if (exists.type === 'error') {
    return exists
  }

  return exists.data
    ? Result.success(null)
    : Result.error(DomainErrors.notFound(entityMessages.salon, salonId))
}
