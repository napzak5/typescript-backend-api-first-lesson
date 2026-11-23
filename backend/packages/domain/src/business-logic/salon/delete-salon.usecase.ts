import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { parseSalonId, type SalonId } from '../../models/salon'
import { type DomainError, DomainErrors } from '../../shared'
import { unfinishedBookingsReferTo } from '../_shared/unfinished-bookings'
import { mayDeleteSalon } from './_shared/authorization'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

export class DeleteSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Marks the salon as deleted; its row and calendar are kept. A salon that
   * has a booking that is not finished stays. Resolves to the ID of the
   * deleted salon.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<SalonId, DomainError>> {
    const salonId = parseSalonId(id)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayDeleteSalon(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const deleted = await this.dependencies.salonRepository.delete(salonId.data)
    if (deleted.type === 'error') {
      return deleted
    }

    return match(deleted.data)
      .returnType<Result<SalonId, DomainError>>()
      .with({ type: 'deleted' }, () => salonId)
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound(entityMessages.salon, salonId.data)),
      )
      .with({ type: 'bookingsUnfinished' }, () =>
        Result.error(unfinishedBookingsReferTo('salon')),
      )
      .exhaustive()
  }
}
