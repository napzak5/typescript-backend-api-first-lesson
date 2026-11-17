import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The treatment record of the request. */
export type TreatmentRecordParams = { id: string }

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
