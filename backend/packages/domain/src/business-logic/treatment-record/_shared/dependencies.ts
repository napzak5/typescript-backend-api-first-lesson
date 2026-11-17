import type { ITreatmentRecordRepository } from '../../../repositories/treatment-record.repository'

/** Everything the use cases of the treatment records need from the outside. */
export interface TreatmentRecordUseCaseDependencies {
  treatmentRecordRepository: ITreatmentRecordRepository
}
