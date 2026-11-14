import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IServiceCategoryRepository } from '../../../repositories/service-category.repository'

/** Everything the service category use cases need from the outside. */
export interface ServiceCategoryUseCaseDependencies {
  serviceCategoryRepository: IServiceCategoryRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
}
