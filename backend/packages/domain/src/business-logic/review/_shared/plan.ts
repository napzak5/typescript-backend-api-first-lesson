import { reviewMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { DbBooking } from '../../../models/booking'
import type { CustomerId } from '../../../models/customer'
import type { RequestedReview, ReviewWrite } from '../../../models/review'
import type { ValidationIssue } from '../../../shared'
import { notFound } from '../../booking/_shared/plan'

/**
 * From a review and the booking it is of, as they are where it is written,
 * to the review that is stored.
 */

/** The booking a review names, as it was found and held. */
export type ReviewedBooking = {
  customerId: string
  salonId: string
  /** Whether the salon of the booking is deleted. */
  salonDeleted: boolean
  status: DbBooking['status']
  /**
   * The staff members who took the booking and are not deleted: the one in
   * charge of it and those of its lines.
   */
  staffIds: string[]
  /** Whether the booking has a review already. */
  reviewed: boolean
}

/** What a review meets where it is written. */
export type ReviewPlanContext = {
  /**
   * Whether the customer the account is linked to is deleted: the staff
   * deleted the customer behind the link of the account.
   */
  reviewerDeleted: boolean
  /** The booking the request names, held; null when there is none. */
  booking: ReviewedBooking | null
}

/**
 * A review to write, or why the request is not one:
 * - `planned`: what is written
 * - `reviewerNotFound`: the customer of the account is deleted, which is
 *   an account without a profile
 * - `invalid`: the request names a booking that is not one of the
 *   customer, a salon that is not the one of the booking, or a staff
 *   member who did not take it
 * - `bookingNotCompleted`: a booking is reviewed once the visit took
 *   place, which is when it is completed
 * - `bookingReviewed`: a booking is reviewed once
 */
export type ReviewPlan =
  | { type: 'planned'; write: ReviewWrite }
  | { type: 'reviewerNotFound' }
  | { type: 'invalid'; issues: ValidationIssue[] }
  | { type: 'bookingNotCompleted' }
  | { type: 'bookingReviewed' }

/** The issues of what a review names of its booking, in the order of the request. */
const issuesOf = (
  request: RequestedReview,
  booking: ReviewedBooking,
): ValidationIssue[] => [
  ...(request.salonId !== booking.salonId || booking.salonDeleted
    ? [notFound('salonId', reviewMessages.theSalonOfBooking)]
    : []),
  ...(request.staffId !== null && !booking.staffIds.includes(request.staffId)
    ? [notFound('staffId', reviewMessages.aStaffMemberWhoTookBooking)]
    : []),
]

/**
 * Plans the review of a customer. Every review written through the API is
 * of a visit that took place, so it is verified.
 */
export const planReview = (
  customerId: CustomerId,
  request: RequestedReview,
  { reviewerDeleted, booking }: ReviewPlanContext,
): ReviewPlan => {
  if (reviewerDeleted) {
    return { type: 'reviewerNotFound' }
  }
  if (booking === null || booking.customerId !== customerId) {
    return {
      type: 'invalid',
      issues: [notFound('bookingId', reviewMessages.aBookingOfCustomer)],
    }
  }
  const issues = issuesOf(request, booking)
  if (issues.length > 0) {
    return { type: 'invalid', issues }
  }
  if (booking.status !== 'completed') {
    return { type: 'bookingNotCompleted' }
  }
  if (booking.reviewed) {
    return { type: 'bookingReviewed' }
  }

  return {
    type: 'planned',
    write: { ...request, customerId, isVerified: true },
  }
}
