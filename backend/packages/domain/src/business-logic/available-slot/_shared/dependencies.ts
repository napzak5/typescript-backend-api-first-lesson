import type { IAvailableSlotRepository } from '../../../repositories/available-slot.repository'
import type { ISalonRepository } from '../../../repositories/salon.repository'

/** Everything the use cases of the available slots need from the outside. */
export interface AvailableSlotUseCaseDependencies {
  availableSlotRepository: IAvailableSlotRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
  /** The current time: a slot that has begun is not offered. */
  clock: () => Date
}
