import type { ISalonRepository } from '../../../repositories/salon.repository'

/**
 * Everything the salon use cases need from the outside. Passing one object
 * keeps construction independent of argument order and lets a test replace
 * a single dependency.
 */
export interface SalonUseCaseDependencies {
  salonRepository: ISalonRepository
}
