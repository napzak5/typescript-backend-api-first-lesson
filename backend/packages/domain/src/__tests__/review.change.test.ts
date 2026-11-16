import { describe, expect, it } from 'vitest'
import {
  type HeldReview,
  planReviewChange,
  planReviewRemoval,
  type ReviewChangeContext,
  type ReviewRemover,
  type ReviewUpdateRequest,
} from '../business-logic/review'
import { type CustomerId, customerIdSchema } from '../models/customer'
import { reviewUpdateRequestSchema } from '../schemas/review.schema'
import { CUSTOMER_ID } from './auth-fixtures'
import { heldReview } from './review-fixtures'

const customerId: CustomerId = customerIdSchema.parse(CUSTOMER_ID)
const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c05'

/** A change that passed the rules of its own. */
const change = (input: Record<string, unknown>): ReviewUpdateRequest =>
  reviewUpdateRequestSchema.parse(input)

/** What the change meets: the customer is there, and so is the review. */
const context = (
  review: HeldReview | null = heldReview(),
  reviewerDeleted = false,
): ReviewChangeContext => ({ reviewerDeleted, review })

const STAFF_RATING_OF_NO_ONE = {
  type: 'invalid',
  issues: [
    {
      field: 'staffRating',
      rule: 'custom',
      message: 'Must be null when the review names no staff member',
    },
  ],
}

describe('planReviewChange', () => {
  it('writes what the request names', () => {
    const request = change({ overallRating: 2, title: null, imageUrls: [] })

    expect(planReviewChange(customerId, request, context())).toEqual({
      type: 'planned',
      write: { overallRating: 2, title: null, imageUrls: [] },
    })
  })

  it('refuses the customer of an account whose customer was deleted, whatever the review', () => {
    for (const review of [heldReview(), null]) {
      expect(
        planReviewChange(
          customerId,
          change({ overallRating: 2 }),
          context(review, true),
        ),
      ).toEqual({ type: 'reviewerNotFound' })
    }
  })

  it('finds no review that is not there, or of a deleted salon', () => {
    expect(
      planReviewChange(customerId, change({ overallRating: 2 }), context(null)),
    ).toEqual({ type: 'reviewNotFound' })
  })

  it('refuses a review of another customer, before what the request says of it', () => {
    const theirs = heldReview({ customerId: OTHER_CUSTOMER_ID, staffId: null })

    expect(
      planReviewChange(customerId, change({ staffRating: 4 }), context(theirs)),
    ).toEqual({ type: 'notTheAuthor' })
  })

  it('refuses a staff rating of a review that names no staff member', () => {
    expect(
      planReviewChange(
        customerId,
        change({ staffRating: 4, title: '再訪' }),
        context(heldReview({ staffId: null })),
      ),
    ).toEqual(STAFF_RATING_OF_NO_ONE)
  })

  it.each<[string, Record<string, unknown>]>([
    ['no staff rating', { title: '再訪' }],
    ['a staff rating that is cleared', { staffRating: null }],
  ])('takes %s for a review that names no staff member', (_, input) => {
    expect(
      planReviewChange(
        customerId,
        change(input),
        context(heldReview({ staffId: null })),
      ),
    ).toEqual({ type: 'planned', write: input })
  })

  it('takes a staff rating of a review that names a staff member', () => {
    expect(
      planReviewChange(customerId, change({ staffRating: 1 }), context()),
    ).toEqual({ type: 'planned', write: { staffRating: 1 } })
  })
})

describe('planReviewRemoval', () => {
  const ADMINISTRATOR: ReviewRemover = { type: 'administrator' }
  const AUTHOR: ReviewRemover = { type: 'author', customerId }

  it('removes a review of the customer for its author', () => {
    expect(planReviewRemoval(AUTHOR, context())).toEqual({ type: 'planned' })
  })

  it('removes a review of any customer for an administrator', () => {
    for (const review of [
      heldReview(),
      heldReview({ customerId: OTHER_CUSTOMER_ID, staffId: null }),
    ]) {
      expect(planReviewRemoval(ADMINISTRATOR, context(review))).toEqual({
        type: 'planned',
      })
    }
  })

  it('removes a review for an administrator whatever became of its author', () => {
    expect(
      planReviewRemoval(ADMINISTRATOR, context(heldReview(), true)),
    ).toEqual({ type: 'planned' })
  })

  it.each<[string, ReviewRemover]>([
    ['an administrator', ADMINISTRATOR],
    ['the author', AUTHOR],
  ])('finds no review that is not there for %s', (_, remover) => {
    expect(planReviewRemoval(remover, context(null))).toEqual({
      type: 'reviewNotFound',
    })
  })

  it('refuses a review of another customer for a customer', () => {
    expect(
      planReviewRemoval(
        AUTHOR,
        context(heldReview({ customerId: OTHER_CUSTOMER_ID })),
      ),
    ).toEqual({ type: 'notTheAuthor' })
  })

  it('refuses the customer of an account whose customer was deleted, whatever the review', () => {
    for (const review of [heldReview(), null]) {
      expect(planReviewRemoval(AUTHOR, context(review, true))).toEqual({
        type: 'reviewerNotFound',
      })
    }
  })
})
