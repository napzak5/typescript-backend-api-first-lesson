import type { IMedicalChartRepository } from '../../../repositories/medical-chart.repository'

/** Everything the medical chart use cases need from the outside. */
export interface MedicalChartUseCaseDependencies {
  medicalChartRepository: IMedicalChartRepository
  /** The current time. */
  clock: () => Date
}
