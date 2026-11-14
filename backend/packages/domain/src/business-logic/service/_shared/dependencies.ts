import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IServiceRepository } from '../../../repositories/service.repository'

/** Everything the service use cases need from the outside. */
export interface ServiceUseCaseDependencies {
  serviceRepository: IServiceRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
}
