import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The review of the request. */
export type ReviewParams = { id: string }

/** The salon of a request to `/salons/:salonId/reviews/...`. */
export type SalonReviewParams = { salonId: string }

/** The staff member of a request to `/staff/:staffId/reviews/...`. */
export type StaffReviewParams = { staffId: string }

export type ListReviewsResponse = JsonBody<
  operations['ReviewCrud_list']['responses'][200]['content']
>
export type CreateReviewResponse = JsonBody<
  operations['ReviewCrud_create']['responses'][201]['content']
>
export type GetReviewResponse = JsonBody<
  operations['ReviewCrud_get']['responses'][200]['content']
>
export type UpdateReviewResponse = JsonBody<
  operations['ReviewCrud_update']['responses'][200]['content']
>
export type MarkReviewHelpfulResponse = JsonBody<
  operations['ReviewCrud_markHelpful']['responses'][200]['content']
>
export type GetSalonReviewSummaryResponse = JsonBody<
  operations['SalonReviewSummary_getSummary']['responses'][200]['content']
>
export type GetStaffReviewSummaryResponse = JsonBody<
  operations['StaffReviewSummary_getStaffSummary']['responses'][200]['content']
>
