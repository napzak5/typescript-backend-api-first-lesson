import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  reviewCreateRequest,
  reviewedBooking,
} from '../../../__tests__/fixtures/review-fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import type { DbBooking } from '../../../models/booking'
import type { CustomerId } from '../../../models/customer'
import { customerIdSchema } from '../../../models/customer'
import {
  type ReviewCreateRequest,
  reviewCreateRequestSchema,
} from '../../../schemas/review.schema'
import { planReview, type ReviewedBooking, type ReviewPlan } from '..'

const customerId: CustomerId = customerIdSchema.parse(CUSTOMER_ID)
const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c05'

/** A review that passed the rules of its own. */
const request = (
  overrides: Parameters<typeof reviewCreateRequest>[0] = {},
): ReviewCreateRequest =>
  reviewCreateRequestSchema.parse(reviewCreateRequest(overrides))

/** The plan of the review of the customer, whose profile is there. */
const planOf = (
  review: ReviewCreateRequest,
  booking: ReviewedBooking | null,
): ReviewPlan =>
  planReview(customerId, review, { reviewerDeleted: false, booking })

/** The broken rules of an invalid plan, as `field:rule`; empty for anything else. */
const rulesOf = (plan: ReviewPlan): string[] =>
  plan.type === 'invalid'
    ? plan.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []

describe('planReview', () => {
  it('writes the review of the customer as one that is verified', () => {
    expect(planOf(request(), reviewedBooking())).toEqual({
      type: 'planned',
      write: {
        salonId: SALON_ID,
        customerId: CUSTOMER_ID,
        bookingId: reviewCreateRequest().bookingId,
        staffId: STAFF_MEMBER_ID,
        overallRating: 4,
        serviceRating: 5,
        staffRating: 5,
        atmosphereRating: 4,
        cleanlinessRating: null,
        valueRating: 3,
        title: '丁寧なカット',
        comment: '仕上がりに満足しています。',
        imageUrls: reviewCreateRequest().imageUrls,
        isVerified: true,
      },
    })
  })

  it('writes a review of no staff member', () => {
    const plan = planOf(
      request({ staffId: null, staffRating: null }),
      reviewedBooking({ staffIds: [] }),
    )

    expect(plan).toMatchObject({
      type: 'planned',
      write: { staffId: null, staffRating: null },
    })
  })

  it('writes a review of a staff member of a line of the booking', () => {
    const plan = planOf(
      request({ staffId: OTHER_STAFF_MEMBER_ID }),
      reviewedBooking({ staffIds: [STAFF_MEMBER_ID, OTHER_STAFF_MEMBER_ID] }),
    )

    expect(plan).toMatchObject({
      type: 'planned',
      write: { staffId: OTHER_STAFF_MEMBER_ID },
    })
  })

  it('refuses a customer who was deleted behind the link of the account, before anything else', () => {
    expect(
      planReview(customerId, request({ salonId: OTHER_SALON_ID }), {
        reviewerDeleted: true,
        booking: null,
      }),
    ).toEqual({ type: 'reviewerNotFound' })
    expect(
      planReview(customerId, request(), {
        reviewerDeleted: true,
        booking: reviewedBooking(),
      }),
    ).toEqual({ type: 'reviewerNotFound' })
  })

  it('refuses a booking that is not there', () => {
    const plan = planOf(request(), null)

    expect(rulesOf(plan)).toEqual(['bookingId:not_found'])
    expect(plan).toEqual({
      type: 'invalid',
      issues: [
        {
          field: 'bookingId',
          rule: 'not_found',
          message: 'Must name a booking of the customer',
        },
      ],
    })
  })

  it('refuses a booking of another customer, whatever else it is', () => {
    const plan = planOf(
      request({ salonId: OTHER_SALON_ID }),
      reviewedBooking({ customerId: OTHER_CUSTOMER_ID, status: 'confirmed' }),
    )

    expect(rulesOf(plan)).toEqual(['bookingId:not_found'])
  })

  it('refuses a salon that is not the one of the booking', () => {
    const plan = planOf(request({ salonId: OTHER_SALON_ID }), reviewedBooking())

    expect(plan).toEqual({
      type: 'invalid',
      issues: [
        {
          field: 'salonId',
          rule: 'not_found',
          message: 'Must name the salon of the booking',
        },
      ],
    })
  })

  it('refuses the salon of the booking once it is deleted', () => {
    expect(
      rulesOf(planOf(request(), reviewedBooking({ salonDeleted: true }))),
    ).toEqual(['salonId:not_found'])
  })

  it('refuses a staff member who did not take the booking, or is deleted', () => {
    const plan = planOf(
      request({ staffId: OTHER_STAFF_MEMBER_ID }),
      reviewedBooking(),
    )

    expect(plan).toEqual({
      type: 'invalid',
      issues: [
        {
          field: 'staffId',
          rule: 'not_found',
          message: 'Must name a staff member who took the booking',
        },
      ],
    })
    expect(
      rulesOf(planOf(request(), reviewedBooking({ staffIds: [] }))),
    ).toEqual(['staffId:not_found'])
  })

  it('reports the salon and the staff member together, before the state of the booking', () => {
    const plan = planOf(
      request({ salonId: OTHER_SALON_ID, staffId: OTHER_STAFF_MEMBER_ID }),
      reviewedBooking({ status: 'pending', reviewed: true }),
    )

    expect(rulesOf(plan)).toEqual(['salonId:not_found', 'staffId:not_found'])
  })

  it.each<DbBooking['status']>([
    'draft',
    'pending',
    'confirmed',
    'in_progress',
    'cancelled',
    'no_show',
  ])('refuses a booking that is %s', (status) => {
    expect(planOf(request(), reviewedBooking({ status }))).toEqual({
      type: 'bookingNotCompleted',
    })
  })

  it('refuses a booking that is not completed before one that is reviewed', () => {
    expect(
      planOf(
        request(),
        reviewedBooking({ status: 'cancelled', reviewed: true }),
      ),
    ).toEqual({ type: 'bookingNotCompleted' })
  })

  it('refuses a booking that has a review already', () => {
    expect(planOf(request(), reviewedBooking({ reviewed: true }))).toEqual({
      type: 'bookingReviewed',
    })
  })
})
