import type { IPointRepository } from '../../../repositories/point.repository'

/** Everything the point use cases need from the outside. */
export interface PointUseCaseDependencies {
  pointRepository: IPointRepository
  /** The current time, against which an expiry date is checked. */
  clock: () => Date
}
