import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The treatment record of the request. */
export type TreatmentRecordParams = { id: string }

/** The treatment record and the photo of the request. */
export type TreatmentPhotoParams = { id: string; photoId: string }

export type ListTreatmentRecordsResponse = JsonBody<
  operations['TreatmentRecordCrud_list']['responses'][200]['content']
>
export type CreateTreatmentRecordResponse = JsonBody<
  operations['TreatmentRecordCrud_create']['responses'][201]['content']
>
export type GetTreatmentRecordResponse = JsonBody<
  operations['TreatmentRecordCrud_get']['responses'][200]['content']
>
export type UpdateTreatmentRecordResponse = JsonBody<
  operations['TreatmentRecordCrud_update']['responses'][200]['content']
>
export type AddTreatmentPhotosResponse = JsonBody<
  operations['TreatmentRecordCrud_addPhotos']['responses'][201]['content']
>
export type GetTreatmentStatisticsResponse = JsonBody<
  operations['TreatmentRecordCrud_getStatistics']['responses'][200]['content']
>
