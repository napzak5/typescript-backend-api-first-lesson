export type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'
export { photoAdditionRefusal } from './_shared/photos'
export {
  type CreationFacts,
  creationIssues,
  isTreated,
  type NamedOfTreatment,
  type TreatmentFacts,
  treatmentIssues,
} from './_shared/rules'
export { AddTreatmentPhotosUseCase } from './add-treatment-photos.usecase'
export { CreateTreatmentRecordUseCase } from './create-treatment-record.usecase'
export { DeleteTreatmentRecordUseCase } from './delete-treatment-record.usecase'
export { GetTreatmentRecordUseCase } from './get-treatment-record.usecase'
export { GetTreatmentStatisticsUseCase } from './get-treatment-statistics.usecase'
export { ListTreatmentRecordsUseCase } from './list-treatment-records.usecase'
export { RemoveTreatmentPhotoUseCase } from './remove-treatment-photo.usecase'
export { UpdateTreatmentRecordUseCase } from './update-treatment-record.usecase'
