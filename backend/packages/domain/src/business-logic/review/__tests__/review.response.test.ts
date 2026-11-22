import { describe, expect, it } from 'vitest'
import { OTHER_SALON_ID, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import { salonIdSchema } from '../../../models/salon'
import { planReviewResponse, type ReviewResponder } from '..'
import { mayRespondWith } from '../_shared/response'

const salon: ReviewResponder = {
  type: 'salon',
  salonId: salonIdSchema.parse(SALON_ID),
}

const administrator: ReviewResponder = { type: 'administrator' }

describe('mayRespondWith', () => {
  it('lets a salon write a response and take it down', () => {
    expect(mayRespondWith(salon, 'ご来店ありがとうございました。')).toBe(true)
    expect(mayRespondWith(salon, null)).toBe(true)
  })

  it('lets an administrator take a response down, and write none', () => {
    expect(mayRespondWith(administrator, null)).toBe(true)
    expect(
      mayRespondWith(administrator, 'ご来店ありがとうございました。'),
    ).toBe(false)
  })
})

describe('planReviewResponse', () => {
  it('responds to a review of the salon for a salon', () => {
    expect(planReviewResponse(salon, { salonId: SALON_ID })).toEqual({
      type: 'planned',
    })
  })

  it('refuses a review of another salon for a salon', () => {
    expect(planReviewResponse(salon, { salonId: OTHER_SALON_ID })).toEqual({
      type: 'otherSalon',
    })
  })

  it('takes down the response to a review of any salon for an administrator', () => {
    for (const salonId of [SALON_ID, OTHER_SALON_ID]) {
      expect(planReviewResponse(administrator, { salonId })).toEqual({
        type: 'planned',
      })
    }
  })

  it('finds no review that is not there, or of a deleted salon, before it looks at whose it is', () => {
    for (const responder of [salon, administrator]) {
      expect(planReviewResponse(responder, null)).toEqual({
        type: 'reviewNotFound',
      })
    }
  })
})
