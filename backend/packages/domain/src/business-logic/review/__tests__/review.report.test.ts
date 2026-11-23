import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID, USER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import { REVIEW_ID } from '../../../__tests__/fixtures/review-fixtures'
import { userIdSchema } from '../../../models/auth'
import { customerIdSchema } from '../../../models/customer'
import { reviewIdSchema } from '../../../models/review'
import { salonIdSchema } from '../../../models/salon'
import { DomainErrors } from '../../../shared'
import { planReportDismissal } from '../../review-report'
import { planReviewReport, type ReportedReview, type ReviewReporter } from '..'
import { toUnreportedReviewError } from '../_shared/refusals'

const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c05'

const customer: ReviewReporter = {
  type: 'customer',
  userId: userIdSchema.parse(USER_ID),
  customerId: customerIdSchema.parse(CUSTOMER_ID),
}

const salon: ReviewReporter = {
  type: 'salon',
  userId: userIdSchema.parse(USER_ID),
  salonId: salonIdSchema.parse(SALON_ID),
}

/** A review of another customer, of the salon of the reporter. */
const reportedReview = (
  overrides: Partial<ReportedReview> = {},
): ReportedReview => ({
  customerId: OTHER_CUSTOMER_ID,
  salonId: SALON_ID,
  ...overrides,
})

describe('planReviewReport', () => {
  it('reports a review of another customer for a customer', () => {
    expect(
      planReviewReport(customer, {
        reporterDeleted: false,
        review: reportedReview(),
      }),
    ).toEqual({ type: 'planned' })
  })

  it('reports a review of another salon for a customer: a customer reports a review of any salon', () => {
    expect(
      planReviewReport(customer, {
        reporterDeleted: false,
        review: reportedReview({ salonId: OTHER_SALON_ID }),
      }),
    ).toEqual({ type: 'planned' })
  })

  it('refuses a review of the customer', () => {
    expect(
      planReviewReport(customer, {
        reporterDeleted: false,
        review: reportedReview({ customerId: CUSTOMER_ID }),
      }),
    ).toEqual({ type: 'ownReview' })
  })

  it('reports a review of the salon for a salon, whoever wrote it', () => {
    for (const customerId of [OTHER_CUSTOMER_ID, CUSTOMER_ID]) {
      expect(
        planReviewReport(salon, {
          reporterDeleted: false,
          review: reportedReview({ customerId }),
        }),
      ).toEqual({ type: 'planned' })
    }
  })

  it('refuses a review of another salon for a salon', () => {
    expect(
      planReviewReport(salon, {
        reporterDeleted: false,
        review: reportedReview({ salonId: OTHER_SALON_ID }),
      }),
    ).toEqual({ type: 'otherSalon' })
  })

  it('finds no review that is not there, or of a deleted salon, before it looks at whose it is', () => {
    for (const reporter of [customer, salon]) {
      expect(
        planReviewReport(reporter, { reporterDeleted: false, review: null }),
      ).toEqual({ type: 'reviewNotFound' })
    }
  })

  it('refuses the customer of an account whose customer was deleted, whatever the review', () => {
    for (const review of [
      reportedReview(),
      reportedReview({ customerId: CUSTOMER_ID }),
      null,
    ]) {
      expect(
        planReviewReport(customer, { reporterDeleted: true, review }),
      ).toEqual({ type: 'reporterNotFound' })
    }
  })
})

describe('toUnreportedReviewError', () => {
  it('should answer a review that is not there as a review that was not found, by its ID', () => {
    // Arrange
    const id = reviewIdSchema.parse(REVIEW_ID)

    // Act
    const error = toUnreportedReviewError({ type: 'reviewNotFound' }, id)

    // Assert
    expect(error).toEqual(DomainErrors.notFound(entityMessages.review, id))
  })

  it.each<['reporterNotFound' | 'ownReview' | 'otherSalon']>([
    ['reporterNotFound'],
    ['ownReview'],
    ['otherSalon'],
  ])(
    'should refuse a report that is %s without saying whether the review is there',
    (type) => {
      // Arrange
      const id = reviewIdSchema.parse(REVIEW_ID)

      // Act
      const error = toUnreportedReviewError({ type }, id)

      // Assert
      expect(error).toEqual(DomainErrors.forbidden())
    },
  )
})

describe('planReportDismissal', () => {
  it('dismisses a pending report', () => {
    expect(planReportDismissal({ report: { status: 'pending' } })).toEqual({
      type: 'planned',
    })
  })

  it('refuses a report dismissed already', () => {
    expect(planReportDismissal({ report: { status: 'dismissed' } })).toEqual({
      type: 'dismissedAlready',
    })
  })

  it('finds no report that is not there, or of a review of a deleted salon', () => {
    expect(planReportDismissal({ report: null })).toEqual({
      type: 'reportNotFound',
    })
  })
})
