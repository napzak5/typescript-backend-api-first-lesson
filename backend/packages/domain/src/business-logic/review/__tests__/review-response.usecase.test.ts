import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import { brokenRules, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  apiReview,
  dbReview,
  OWNER_RESPONSE,
  REVIEW_ID,
  reviewDependencies,
} from '../../../__tests__/fixtures/review-fixtures'
import type { Actor } from '../../../models/auth'
import type { ReviewResponding } from '../../../repositories/review.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import { RespondToReviewUseCase, type ReviewUseCaseDependencies } from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** The message of a failed validation; null for anything else. */
const validationMessageOf = (
  result: Result<unknown, DomainError>,
): string | null =>
  result.type === 'error' && result.error.type === 'validation'
    ? toldIn(result.error.message, 'en')
    : null

const response = { ownerResponse: OWNER_RESPONSE }
const takenDown = { ownerResponse: null }

/** The review of the fixtures with the response of the salon. */
const respondedReview = apiReview({
  ownerResponse: OWNER_RESPONSE,
  ownerRespondedAt: '2026-11-21T01:00:00.500Z',
})

describe('RespondToReviewUseCase', () => {
  const respond = (
    dependencies: ReviewUseCaseDependencies,
    actor: Actor = actors.ofSalon('owner'),
    id: unknown = REVIEW_ID,
    input: unknown = response,
  ) => new RespondToReviewUseCase(dependencies).execute(actor, id, input)

  const responding = (outcome: ReviewResponding) => ({
    respond: vi.fn(async () => Result.success(outcome)),
  })

  const repositoryWasNotCalled = (dependencies: ReviewUseCaseDependencies) => {
    expect(
      vi.mocked(dependencies.reviewRepository.respond),
    ).not.toHaveBeenCalled()
  }

  it.each(['owner', 'manager'] as const)(
    'writes the response of the salon for the %s of a salon and returns the review',
    async (role) => {
      const dependencies = reviewDependencies()

      expect(await respond(dependencies, actors.ofSalon(role))).toEqual({
        type: 'success',
        data: respondedReview,
      })
      expect(dependencies.reviewRepository.respond).toHaveBeenCalledWith(
        REVIEW_ID,
        { type: 'salon', salonId: SALON_ID },
        response,
      )
    },
  )

  it.each(['owner', 'manager'] as const)(
    'takes the response down for the %s of a salon',
    async (role) => {
      const dependencies = reviewDependencies(
        responding({ type: 'responded', review: dbReview() }),
      )

      expect(
        await respond(dependencies, actors.ofSalon(role), REVIEW_ID, takenDown),
      ).toEqual({ type: 'success', data: apiReview() })
      expect(dependencies.reviewRepository.respond).toHaveBeenCalledWith(
        REVIEW_ID,
        { type: 'salon', salonId: SALON_ID },
        takenDown,
      )
    },
  )

  it('takes the response down for an administrator', async () => {
    const dependencies = reviewDependencies(
      responding({ type: 'responded', review: dbReview() }),
    )

    expect(
      await respond(dependencies, actors.admin, REVIEW_ID, takenDown),
    ).toEqual({ type: 'success', data: apiReview() })
    expect(dependencies.reviewRepository.respond).toHaveBeenCalledWith(
      REVIEW_ID,
      { type: 'administrator' },
      takenDown,
    )
  })

  it('refuses a response an administrator writes without asking the repository', async () => {
    const dependencies = reviewDependencies()

    expect(await respond(dependencies, actors.admin)).toEqual({
      type: 'error',
      error: DomainErrors.forbidden(),
    })
    repositoryWasNotCalled(dependencies)
  })

  it('reads the request of an administrator before it refuses what it says', async () => {
    const dependencies = reviewDependencies()

    const responded = await respond(dependencies, actors.admin, REVIEW_ID, {
      ownerResponse: ' ',
    })

    expect(rulesOf(responded)).toEqual(['ownerResponse:invalid_format'])
    repositoryWasNotCalled(dependencies)
  })

  it('looks for the review by its ID in lower case', async () => {
    const dependencies = reviewDependencies()

    await respond(
      dependencies,
      actors.ofSalon('owner'),
      REVIEW_ID.toUpperCase(),
    )

    expect(dependencies.reviewRepository.respond).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.anything(),
      response,
    )
  })

  it.each<[string, Actor]>([
    ['a staff member', actors.ofSalon('staff')],
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
    ['an account of a salon that reaches no salon', actors.withoutScope],
  ])('refuses %s before the ID and the request are read', async (_, actor) => {
    const dependencies = reviewDependencies()

    expect(
      await respond(dependencies, actor, 'not-a-uuid', { broken: true }),
    ).toEqual({ type: 'error', error: DomainErrors.forbidden() })
    repositoryWasNotCalled(dependencies)
  })

  it('refuses an ID that is not a UUID before the request is read', async () => {
    for (const actor of [actors.ofSalon('owner'), actors.admin]) {
      const dependencies = reviewDependencies()

      const responded = await respond(dependencies, actor, 'latest', {
        broken: true,
      })

      expect(rulesOf(responded)).toEqual(['id:invalid_format'])
      expect(validationMessageOf(responded)).toBe('Invalid review ID')
      repositoryWasNotCalled(dependencies)
    }
  })

  it('takes a long response: its length is not limited, as that of a comment is not', async () => {
    const dependencies = reviewDependencies()
    const long = { ownerResponse: '𠮷'.repeat(10000) }

    expect(
      await respond(dependencies, actors.ofSalon('owner'), REVIEW_ID, long),
    ).toMatchObject({ type: 'success' })
    expect(dependencies.reviewRepository.respond).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.anything(),
      long,
    )
  })

  it.each<[string, unknown, string[]]>([
    ['a request without the response', {}, ['ownerResponse:invalid_type']],
    [
      'a blank response',
      { ownerResponse: ' \n\t　' },
      ['ownerResponse:invalid_format'],
    ],
    [
      'an empty response',
      { ownerResponse: '' },
      ['ownerResponse:invalid_format'],
    ],
    [
      'a response that is not text',
      { ownerResponse: 1 },
      ['ownerResponse:invalid_type'],
    ],
    [
      'a property the request does not have',
      { ...response, ownerRespondedAt: '2026-11-21T01:00:00Z' },
      ['ownerRespondedAt:unrecognized_keys'],
    ],
    ['a request that is not an object', [OWNER_RESPONSE], [':invalid_type']],
  ])('refuses %s without asking the repository', async (_, input, rules) => {
    const dependencies = reviewDependencies()

    const responded = await respond(
      dependencies,
      actors.ofSalon('owner'),
      REVIEW_ID,
      input,
    )

    expect(rulesOf(responded)).toEqual(rules)
    expect(validationMessageOf(responded)).toBe('Invalid review response')
    repositoryWasNotCalled(dependencies)
  })

  it.each<[string, ReviewResponding, DomainError]>([
    [
      'a review that is not there, or of a deleted salon, as not found',
      { type: 'reviewNotFound' },
      DomainErrors.notFound('Review', REVIEW_ID),
    ],
    [
      'a salon responding to a review of another salon as forbidden',
      { type: 'otherSalon' },
      DomainErrors.forbidden(),
    ],
  ])('answers %s', async (_, outcome, error) => {
    const dependencies = reviewDependencies(responding(outcome))

    expect(await respond(dependencies)).toEqual({ type: 'error', error })
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      respond: vi.fn(async () => databaseDown),
    })

    expect(await respond(dependencies)).toEqual(databaseDown)
  })

  it('fails on a stored review that does not match the API model', async () => {
    const dependencies = reviewDependencies(
      responding({
        type: 'responded',
        review: dbReview({ ownerRespondedAt: 'yesterday' }),
      }),
    )

    expect(await respond(dependencies)).toEqual({
      type: 'error',
      error: expect.objectContaining({
        type: 'database',
        message: `Stored review ${REVIEW_ID} does not match the API model`,
      }),
    })
  })
})
