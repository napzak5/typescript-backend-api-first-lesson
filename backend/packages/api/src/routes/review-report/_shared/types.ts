import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The report of the request. */
export type ReviewReportParams = { id: string }

export type ListReviewReportsResponse = JsonBody<
  operations['ReviewReportCrud_list']['responses'][200]['content']
>
export type DismissReviewReportResponse = JsonBody<
  operations['ReviewReportCrud_dismiss']['responses'][200]['content']
>
