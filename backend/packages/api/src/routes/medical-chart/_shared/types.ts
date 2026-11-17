import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The medical chart of the request. */
export type MedicalChartParams = { id: string }

/** The customer whose medical chart, or whose allergies, the request reads. */
export type MedicalChartCustomerParams = { customerId: string }

/** An allergy of the customer of the request. */
export type CustomerAllergyParams = { customerId: string; allergyId: string }

export type ListMedicalChartsResponse = JsonBody<
  operations['MedicalChartCrud_list']['responses'][200]['content']
>
export type CreateMedicalChartResponse = JsonBody<
  operations['MedicalChartCrud_create']['responses'][201]['content']
>
export type GetMedicalChartResponse = JsonBody<
  operations['MedicalChartCrud_getByCustomer']['responses'][200]['content']
>
export type UpdateMedicalChartResponse = JsonBody<
  operations['MedicalChartCrud_update']['responses'][200]['content']
>
export type ListCustomerAllergiesResponse = JsonBody<
  operations['MedicalChartCrud_listAllergies']['responses'][200]['content']
>
export type AddCustomerAllergyResponse = JsonBody<
  operations['MedicalChartCrud_addAllergy']['responses'][201]['content']
>
export type UpdateCustomerAllergyResponse = JsonBody<
  operations['MedicalChartCrud_updateAllergy']['responses'][200]['content']
>
