import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { heldReview } from '../../../__tests__/fixtures/review-fixtures'
import { type CustomerId, customerIdSchema } from '../../../models/customer'
import { type HeldReview, planHelpfulMark, type ReviewChangeContext } from '..'

const customerId: CustomerId = customerIdSchema.parse(CUSTOMER_ID)
const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c05'

/** What the mark meets: the customer is there, and so is a review of another customer. */
const context = (
  review: HeldReview | null = heldReview({ customerId: OTHER_CUSTOMER_ID }),
  reviewerDeleted = false,
): ReviewChangeContext => ({ reviewerDeleted, review })

describe('planHelpfulMark', () => {
  it('marks a review of another customer', () => {
    expect(planHelpfulMark(customerId, context())).toEqual({ type: 'planned' })
  })

  it('marks a review that names no staff member', () => {
    expect(
      planHelpfulMark(
        customerId,
        context(heldReview({ customerId: OTHER_CUSTOMER_ID, staffId: null })),
      ),
    ).toEqual({ type: 'planned' })
  })

  it('refuses a review of the customer', () => {
    expect(planHelpfulMark(customerId, context(heldReview()))).toEqual({
      type: 'ownReview',
    })
  })

  it('finds no review that is not there, or of a deleted salon', () => {
    expect(planHelpfulMark(customerId, context(null))).toEqual({
      type: 'reviewNotFound',
    })
  })

  it('refuses the customer of an account whose customer was deleted, whatever the review', () => {
    for (const review of [
      heldReview({ customerId: OTHER_CUSTOMER_ID }),
      heldReview(),
      null,
    ]) {
      expect(planHelpfulMark(customerId, context(review, true))).toEqual({
        type: 'reviewerNotFound',
      })
    }
  })
})
