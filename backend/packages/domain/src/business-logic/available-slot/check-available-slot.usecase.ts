import { Result } from '@beauty-salon-backend/utility'
import { parseISO } from 'date-fns'
import type { Actor } from '../../models/auth'
import type { ApiAvailableSlotCheckResponse } from '../../models/available-slot'
import { parseSalonIdOfPath } from '../../models/salon'
import { availableSlotCheckRequestSchema } from '../../schemas/available-slot.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import {
  conflictsOf,
  isOccupiedBeyondCapacity,
  timeOf,
} from '../booking/_shared/occupancy'
import { notFound } from '../booking/_shared/plan'
import { mayAskLedgerOf } from './_shared/authorization'
import type { AvailableSlotUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid available slot check'

export class CheckAvailableSlotUseCase {
  constructor(
    private readonly dependencies: AvailableSlotUseCaseDependencies,
  ) {}

  /**
   * Says whether the ledger of the salon would take a booking of the
   * service with the staff member at the time: whether the staff member
   * is not occupied beyond what they take at once, and which bookings are
   * in the way. Nothing else is asked, because the ledger asks nothing
   * else of a booking the salon enters. Whether the actor may is decided
   * from the path alone, before the body is read. The answer is of the
   * moment it is given at: nothing is held for it.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    body: unknown,
  ): Promise<Result<ApiAvailableSlotCheckResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayAskLedgerOf(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(availableSlotCheckRequestSchema, body, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const { availableSlotRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const startTime = parseISO(request.data.startTime)
    const found = await availableSlotRepository.findOccupancy({
      salonId: salonId.data,
      serviceId: request.data.serviceId,
      staffId: request.data.staffId,
      startTime,
    })
    if (found.type === 'error') {
      return found
    }

    const { service, staff, taken } = found.data
    if (service === null || staff === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          ...(staff === null
            ? [notFound('staffId', 'a staff member of the salon')]
            : []),
          ...(service === null
            ? [notFound('serviceId', 'a service of the salon')]
            : []),
        ]),
      )
    }

    const wanted = timeOf(startTime, service.duration)

    return Result.success({
      isAvailable: !isOccupiedBeyondCapacity(staff, [wanted], taken),
      conflicts: conflictsOf(staff, wanted, taken),
    })
  }
}
