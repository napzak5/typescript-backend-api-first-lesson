import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import { actors, CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { BOOKING_ID } from '../../../__tests__/fixtures/booking-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiReview,
  dbReview,
  OTHER_REVIEW_ID,
  REVIEW_ID,
  reviewCreateRequest,
  reviewDependencies,
  reviewTally,
} from '../../../__tests__/fixtures/review-fixtures'
import { STAFF_MEMBER_ID } from '../../../__tests__/fixtures/staff-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  ApiReviewSummaryResponse,
  DbReview,
  ReviewTally,
} from '../../../models/review'
import type {
  IReviewRepository,
  ReviewChange,
  ReviewCreation,
  ReviewList,
  ReviewMark,
  ReviewRemoval,
} from '../../../repositories/review.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  CreateReviewUseCase,
  DeleteReviewUseCase,
  GetReviewUseCase,
  GetSalonReviewSummaryUseCase,
  GetStaffReviewSummaryUseCase,
  ListReviewsUseCase,
  MarkReviewHelpfulUseCase,
  type ReviewUseCaseDependencies,
  UpdateReviewUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({
    type: 'database',
    message: `Stored review ${REVIEW_ID} does not match the API model`,
  }),
}
const summary = {
  averageRating: 4.33,
  totalReviews: 3,
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 1 },
}

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

const repositoryWasNotCalled = (dependencies: ReviewUseCaseDependencies) => {
  const { list, findById, create, update, salonTally, staffTally } =
    dependencies.reviewRepository
  expect(vi.mocked(list)).not.toHaveBeenCalled()
  expect(vi.mocked(findById)).not.toHaveBeenCalled()
  expect(vi.mocked(create)).not.toHaveBeenCalled()
  expect(vi.mocked(update)).not.toHaveBeenCalled()
  expect(vi.mocked(dependencies.reviewRepository.delete)).not.toHaveBeenCalled()
  expect(
    vi.mocked(dependencies.reviewRepository.markHelpful),
  ).not.toHaveBeenCalled()
  expect(vi.mocked(dependencies.reviewRepository.report)).not.toHaveBeenCalled()
  expect(vi.mocked(salonTally)).not.toHaveBeenCalled()
  expect(vi.mocked(staffTally)).not.toHaveBeenCalled()
}

const creating = (outcome: ReviewCreation) => ({
  create: vi.fn(async () => Result.success(outcome)),
})

const updating = (outcome: ReviewChange) => ({
  update: vi.fn(async () => Result.success(outcome)),
})

const deleting = (outcome: ReviewRemoval) => ({
  delete: vi.fn(async () => Result.success(outcome)),
})

const marking = (outcome: ReviewMark) => ({
  markHelpful: vi.fn(async () => Result.success(outcome)),
})

/** The accounts that are not customers with a profile. */
const notReviewers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
  ['an account of a salon that reaches no salon', actors.withoutScope],
  ['a customer without a profile', actors.customerWithoutProfile],
]

describe('ListReviewsUseCase', () => {
  const list = (dependencies: ReviewUseCaseDependencies, input: unknown = {}) =>
    new ListReviewsUseCase(dependencies).execute(input)

  it('lists the first 20 reviews, newest first, without any filter', async () => {
    const dependencies = reviewDependencies()

    expect(await list(dependencies)).toEqual({
      type: 'success',
      data: {
        data: [apiReview()],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
    expect(dependencies.reviewRepository.list).toHaveBeenCalledWith({
      limit: 20,
      after: null,
      sortBy: 'recent',
      salonId: null,
      staffId: null,
      customerId: null,
      bookingId: null,
      isVerified: null,
      minRating: null,
      maxRating: null,
    })
  })

  it('passes every filter, the order and the cursor on', async () => {
    const dependencies = reviewDependencies()

    await list(dependencies, {
      limit: 5,
      cursor: OTHER_REVIEW_ID,
      sortBy: 'rating',
      salonId: SALON_ID,
      staffId: STAFF_MEMBER_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      isVerified: false,
      minRating: 2,
      maxRating: 4,
    })

    expect(dependencies.reviewRepository.list).toHaveBeenCalledWith({
      limit: 5,
      after: OTHER_REVIEW_ID,
      sortBy: 'rating',
      salonId: SALON_ID,
      staffId: STAFF_MEMBER_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      isVerified: false,
      minRating: 2,
      maxRating: 4,
    })
  })

  it('points the next page at the last review of a page that has one after it', async () => {
    const dependencies = reviewDependencies({
      list: vi.fn(async () =>
        Result.success<ReviewList | null>({
          reviews: [dbReview({ id: OTHER_REVIEW_ID }), dbReview()],
          total: 5,
          hasMore: true,
        }),
      ),
    })

    const listed = await list(dependencies, {
      limit: 2,
      cursor: OTHER_REVIEW_ID,
    })

    expect(listed).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: OTHER_REVIEW_ID,
          nextCursor: REVIEW_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('refuses a search that breaks a rule without asking the repository', async () => {
    const dependencies = reviewDependencies()

    const listed = await list(dependencies, { minRating: 5, maxRating: 1 })

    expect(rulesOf(listed)).toEqual(['minRating:custom'])
    expect(validationMessageOf(listed)).toBe('Invalid review search')
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a cursor that names no review that is listed', async () => {
    const dependencies = reviewDependencies({
      list: vi.fn(async () => Result.success<ReviewList | null>(null)),
    })

    const listed = await list(dependencies, { cursor: OTHER_REVIEW_ID })

    expect(listed).toEqual({
      type: 'error',
      error: DomainErrors.validation('Invalid review search', [
        {
          field: 'cursor',
          rule: 'not_found',
          message: 'Must name a review that is listed',
        },
      ]),
    })
  })

  it('fails on a stored review that does not match the API model', async () => {
    const dependencies = reviewDependencies({
      list: vi.fn(async () =>
        Result.success<ReviewList | null>({
          reviews: [dbReview({ imageUrls: null })],
          total: 1,
          hasMore: false,
        }),
      ),
    })

    expect(await list(dependencies)).toEqual(storedRowIsCorrupt)
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })
})

describe('GetReviewUseCase', () => {
  const get = (
    dependencies: ReviewUseCaseDependencies,
    id: unknown = REVIEW_ID,
  ) => new GetReviewUseCase(dependencies).execute(id)

  it('returns the review', async () => {
    const dependencies = reviewDependencies()

    expect(await get(dependencies)).toEqual({
      type: 'success',
      data: apiReview(),
    })
    expect(dependencies.reviewRepository.findById).toHaveBeenCalledWith(
      REVIEW_ID,
    )
  })

  it('looks for the review by its ID in lower case', async () => {
    const dependencies = reviewDependencies()

    await get(dependencies, REVIEW_ID.toUpperCase())

    expect(dependencies.reviewRepository.findById).toHaveBeenCalledWith(
      REVIEW_ID,
    )
  })

  it('refuses an ID that is not a UUID without asking the repository', async () => {
    const dependencies = reviewDependencies()

    const found = await get(dependencies, 'latest')

    expect(rulesOf(found)).toEqual(['id:invalid_format'])
    expect(validationMessageOf(found)).toBe('Invalid review ID')
    repositoryWasNotCalled(dependencies)
  })

  it('answers a review that is not there, or of a deleted salon, as not found', async () => {
    const dependencies = reviewDependencies({
      findById: vi.fn(async () => Result.success<DbReview | null>(null)),
    })

    expect(await get(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.notFound('Review', REVIEW_ID),
    })
  })

  it('fails on a stored review that does not match the API model', async () => {
    const dependencies = reviewDependencies({
      findById: vi.fn(async () =>
        Result.success<DbReview | null>(dbReview({ createdAt: 'never' })),
      ),
    })

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })
})

describe('CreateReviewUseCase', () => {
  const create = (
    dependencies: ReviewUseCaseDependencies,
    actor: Actor = actors.customer,
    input: unknown = reviewCreateRequest(),
  ) => new CreateReviewUseCase(dependencies).execute(actor, input)

  it('writes the review as the signed-in customer and returns it', async () => {
    const dependencies = reviewDependencies()

    expect(await create(dependencies)).toEqual({
      type: 'success',
      data: apiReview(),
    })
    expect(dependencies.reviewRepository.create).toHaveBeenCalledWith(
      CUSTOMER_ID,
      reviewCreateRequest(),
    )
  })

  it.each(notReviewers)(
    'refuses %s before the request is read',
    async (_, actor) => {
      const dependencies = reviewDependencies()

      expect(await create(dependencies, actor, { broken: true })).toEqual({
        type: 'error',
        error: DomainErrors.forbidden(),
      })
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses a request that breaks a rule without asking the repository', async () => {
    const dependencies = reviewDependencies()

    const created = await create(
      dependencies,
      actors.customer,
      reviewCreateRequest({ overallRating: 0, staffId: null }),
    )

    expect(rulesOf(created)).toEqual([
      'overallRating:too_small',
      'staffRating:custom',
    ])
    expect(validationMessageOf(created)).toBe('Invalid review')
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a review written as another customer without asking the repository', async () => {
    const dependencies = reviewDependencies()

    const created = await create(
      dependencies,
      actors.customer,
      reviewCreateRequest({
        customerId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c05',
      }),
    )

    expect(created).toEqual({ type: 'error', error: DomainErrors.forbidden() })
    repositoryWasNotCalled(dependencies)
  })

  it('accepts the ID of the customer in capitals', async () => {
    const dependencies = reviewDependencies()

    const created = await create(
      dependencies,
      actors.customer,
      reviewCreateRequest({ customerId: CUSTOMER_ID.toUpperCase() }),
    )

    expect(created.type).toBe('success')
  })

  it('refuses a customer who was deleted behind the link of the account as an account without a profile', async () => {
    const dependencies = reviewDependencies(
      creating({ type: 'reviewerNotFound' }),
    )

    expect(await create(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.forbidden(),
    })
  })

  it('refuses what the request names of the booking as invalid', async () => {
    const issues = [
      {
        field: 'salonId',
        rule: 'not_found',
        message: 'Must name the salon of the booking',
      },
    ]
    const dependencies = reviewDependencies(
      creating({ type: 'invalid', issues }),
    )

    expect(
      await create(
        dependencies,
        actors.customer,
        reviewCreateRequest({ salonId: OTHER_SALON_ID }),
      ),
    ).toEqual({
      type: 'error',
      error: DomainErrors.validation('Invalid review', issues),
    })
  })

  it('refuses a booking that is not completed as a conflict', async () => {
    const dependencies = reviewDependencies(
      creating({ type: 'bookingNotCompleted' }),
    )

    expect(await create(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.conflict(
        'The booking is not completed; a booking is reviewed once the visit took place',
      ),
    })
  })

  it('refuses a booking that has a review as a conflict', async () => {
    const dependencies = reviewDependencies(
      creating({ type: 'bookingReviewed' }),
    )

    expect(await create(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.conflict(
        'The booking has a review already; a booking is reviewed once',
      ),
    })
  })

  it('fails on a stored review that does not match the API model', async () => {
    const dependencies = reviewDependencies(
      creating({ type: 'created', review: dbReview({ imageUrls: {} }) }),
    )

    expect(await create(dependencies)).toEqual(storedRowIsCorrupt)
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      create: vi.fn(async () => databaseDown),
    })

    expect(await create(dependencies)).toEqual(databaseDown)
  })
})

describe('UpdateReviewUseCase', () => {
  const change = { overallRating: 2, title: null }
  const update = (
    dependencies: ReviewUseCaseDependencies,
    actor: Actor = actors.customer,
    id: unknown = REVIEW_ID,
    input: unknown = change,
  ) => new UpdateReviewUseCase(dependencies).execute(actor, id, input)

  it('changes the review as the signed-in customer and returns it', async () => {
    const dependencies = reviewDependencies(
      updating({
        type: 'updated',
        review: dbReview({ overallRating: 2, title: null }),
      }),
    )

    expect(await update(dependencies)).toEqual({
      type: 'success',
      data: apiReview({ overallRating: 2, title: null }),
    })
    expect(dependencies.reviewRepository.update).toHaveBeenCalledWith(
      REVIEW_ID,
      CUSTOMER_ID,
      change,
    )
  })

  it('looks for the review by its ID in lower case', async () => {
    const dependencies = reviewDependencies()

    await update(dependencies, actors.customer, REVIEW_ID.toUpperCase())

    expect(dependencies.reviewRepository.update).toHaveBeenCalledWith(
      REVIEW_ID,
      CUSTOMER_ID,
      change,
    )
  })

  it.each(notReviewers)(
    'refuses %s before the ID and the request are read',
    async (_, actor) => {
      const dependencies = reviewDependencies()

      expect(
        await update(dependencies, actor, 'not-a-uuid', { broken: true }),
      ).toEqual({ type: 'error', error: DomainErrors.forbidden() })
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses an ID that is not a UUID before the request is read', async () => {
    const dependencies = reviewDependencies()

    const updated = await update(dependencies, actors.customer, 'latest', {})

    expect(rulesOf(updated)).toEqual(['id:invalid_format'])
    expect(validationMessageOf(updated)).toBe('Invalid review ID')
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a change that breaks a rule without asking the repository', async () => {
    const dependencies = reviewDependencies()

    const updated = await update(dependencies, actors.customer, REVIEW_ID, {
      overallRating: null,
      staffId: null,
    })

    expect(rulesOf(updated)).toEqual([
      'overallRating:invalid_type',
      'staffId:unrecognized_keys',
    ])
    expect(validationMessageOf(updated)).toBe('Invalid review update')
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a change that names nothing without asking the repository', async () => {
    const dependencies = reviewDependencies()

    expect(
      rulesOf(await update(dependencies, actors.customer, REVIEW_ID, {})),
    ).toEqual([':custom'])
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a staff rating of a review that names no staff member as invalid', async () => {
    const issues = [
      {
        field: 'staffRating',
        rule: 'custom',
        message: 'Must be null when the review names no staff member',
      },
    ]
    const dependencies = reviewDependencies(
      updating({ type: 'invalid', issues }),
    )

    expect(
      await update(dependencies, actors.customer, REVIEW_ID, {
        staffRating: 4,
      }),
    ).toEqual({
      type: 'error',
      error: DomainErrors.validation('Invalid review update', issues),
    })
  })

  it('answers a review that is not there, or of a deleted salon, as not found', async () => {
    const dependencies = reviewDependencies(
      updating({ type: 'reviewNotFound' }),
    )

    expect(await update(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.notFound('Review', REVIEW_ID),
    })
  })

  it.each<[string, ReviewChange]>([
    ['a review of another customer', { type: 'notTheAuthor' }],
    [
      'a customer who was deleted behind the link of the account',
      { type: 'reviewerNotFound' },
    ],
  ])('refuses %s as forbidden', async (_, outcome) => {
    const dependencies = reviewDependencies(updating(outcome))

    expect(await update(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.forbidden(),
    })
  })

  it('fails on a stored review that does not match the API model', async () => {
    const dependencies = reviewDependencies(
      updating({ type: 'updated', review: dbReview({ imageUrls: {} }) }),
    )

    expect(await update(dependencies)).toEqual(storedRowIsCorrupt)
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })
})

describe('DeleteReviewUseCase', () => {
  const remove = (
    dependencies: ReviewUseCaseDependencies,
    actor: Actor = actors.customer,
    id: unknown = REVIEW_ID,
  ) => new DeleteReviewUseCase(dependencies).execute(actor, id)

  it('removes a review of the signed-in customer as its author', async () => {
    const dependencies = reviewDependencies()

    expect(await remove(dependencies)).toEqual({
      type: 'success',
      data: REVIEW_ID,
    })
    expect(dependencies.reviewRepository.delete).toHaveBeenCalledWith(
      REVIEW_ID,
      { type: 'author', customerId: CUSTOMER_ID },
    )
  })

  it('removes a review as an administrator', async () => {
    const dependencies = reviewDependencies()

    expect(await remove(dependencies, actors.admin)).toEqual({
      type: 'success',
      data: REVIEW_ID,
    })
    expect(dependencies.reviewRepository.delete).toHaveBeenCalledWith(
      REVIEW_ID,
      { type: 'administrator' },
    )
  })

  it('looks for the review by its ID in lower case', async () => {
    const dependencies = reviewDependencies()

    expect(
      await remove(dependencies, actors.customer, REVIEW_ID.toUpperCase()),
    ).toEqual({ type: 'success', data: REVIEW_ID })
    expect(dependencies.reviewRepository.delete).toHaveBeenCalledWith(
      REVIEW_ID,
      { type: 'author', customerId: CUSTOMER_ID },
    )
  })

  it.each<[string, Actor]>([
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
    ['a staff member', actors.ofSalon('staff')],
    ['an account of a salon that reaches no salon', actors.withoutScope],
    ['a customer without a profile', actors.customerWithoutProfile],
  ])('refuses %s before the ID is read', async (_, actor) => {
    const dependencies = reviewDependencies()

    expect(await remove(dependencies, actor, 'not-a-uuid')).toEqual({
      type: 'error',
      error: DomainErrors.forbidden(),
    })
    repositoryWasNotCalled(dependencies)
  })

  it('refuses an ID that is not a UUID without asking the repository', async () => {
    const dependencies = reviewDependencies()

    const removed = await remove(dependencies, actors.admin, 'latest')

    expect(rulesOf(removed)).toEqual(['id:invalid_format'])
    expect(validationMessageOf(removed)).toBe('Invalid review ID')
    repositoryWasNotCalled(dependencies)
  })

  it('answers a review that is not there, or of a deleted salon, as not found', async () => {
    const dependencies = reviewDependencies(
      deleting({ type: 'reviewNotFound' }),
    )

    expect(await remove(dependencies, actors.admin)).toEqual({
      type: 'error',
      error: DomainErrors.notFound('Review', REVIEW_ID),
    })
  })

  it.each<[string, ReviewRemoval]>([
    ['a review of another customer', { type: 'notTheAuthor' }],
    [
      'a customer who was deleted behind the link of the account',
      { type: 'reviewerNotFound' },
    ],
  ])('refuses %s as forbidden', async (_, outcome) => {
    const dependencies = reviewDependencies(deleting(outcome))

    expect(await remove(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.forbidden(),
    })
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      delete: vi.fn(async () => databaseDown),
    })

    expect(await remove(dependencies)).toEqual(databaseDown)
  })
})

describe('MarkReviewHelpfulUseCase', () => {
  const mark = (
    dependencies: ReviewUseCaseDependencies,
    actor: Actor = actors.customer,
    id: unknown = REVIEW_ID,
  ) => new MarkReviewHelpfulUseCase(dependencies).execute(actor, id)

  it('marks the review as the signed-in customer and answers how many customers did', async () => {
    const dependencies = reviewDependencies()

    expect(await mark(dependencies)).toEqual({
      type: 'success',
      data: { helpfulCount: 3 },
    })
    expect(dependencies.reviewRepository.markHelpful).toHaveBeenCalledWith(
      REVIEW_ID,
      CUSTOMER_ID,
    )
  })

  it('looks for the review by its ID in lower case', async () => {
    const dependencies = reviewDependencies()

    expect(
      await mark(dependencies, actors.customer, REVIEW_ID.toUpperCase()),
    ).toEqual({ type: 'success', data: { helpfulCount: 3 } })
    expect(dependencies.reviewRepository.markHelpful).toHaveBeenCalledWith(
      REVIEW_ID,
      CUSTOMER_ID,
    )
  })

  it.each(notReviewers)(
    'refuses %s before the ID is read',
    async (_, actor) => {
      const dependencies = reviewDependencies()

      expect(await mark(dependencies, actor, 'not-a-uuid')).toEqual({
        type: 'error',
        error: DomainErrors.forbidden(),
      })
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses an ID that is not a UUID without asking the repository', async () => {
    const dependencies = reviewDependencies()

    const marked = await mark(dependencies, actors.customer, 'latest')

    expect(rulesOf(marked)).toEqual(['id:invalid_format'])
    expect(validationMessageOf(marked)).toBe('Invalid review ID')
    repositoryWasNotCalled(dependencies)
  })

  it('answers a review that is not there, or of a deleted salon, as not found', async () => {
    const dependencies = reviewDependencies(marking({ type: 'reviewNotFound' }))

    expect(await mark(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.notFound('Review', REVIEW_ID),
    })
  })

  it.each<[string, ReviewMark]>([
    ['a review of the customer', { type: 'ownReview' }],
    [
      'a customer who was deleted behind the link of the account',
      { type: 'reviewerNotFound' },
    ],
  ])('refuses %s as forbidden', async (_, outcome) => {
    const dependencies = reviewDependencies(marking(outcome))

    expect(await mark(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.forbidden(),
    })
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      markHelpful: vi.fn(async () => databaseDown),
    })

    expect(await mark(dependencies)).toEqual(databaseDown)
  })
})

/** One of the two summaries, and how it is asked for. */
type SummaryCase = {
  name: string
  summarize: (
    dependencies: ReviewUseCaseDependencies,
    id: unknown,
  ) => Promise<Result<ApiReviewSummaryResponse, DomainError>>
  /** The method of the repository that counts the reviews. */
  tallyOf: (repository: IReviewRepository) => unknown
  /** A repository whose count answers this. */
  answering: (
    answer: Result<ReviewTally | null, DomainError>,
  ) => Partial<IReviewRepository>
  id: string
  field: string
  message: string
  notFound: DomainError
}

const summaries: SummaryCase[] = [
  {
    name: 'GetSalonReviewSummaryUseCase',
    summarize: (dependencies, id) =>
      new GetSalonReviewSummaryUseCase(dependencies).execute(id),
    tallyOf: (repository) => repository.salonTally,
    answering: (answer) => ({ salonTally: vi.fn(async () => answer) }),
    id: SALON_ID,
    field: 'salonId',
    message: 'Invalid salon ID',
    notFound: DomainErrors.notFound('Salon', SALON_ID),
  },
  {
    name: 'GetStaffReviewSummaryUseCase',
    summarize: (dependencies, id) =>
      new GetStaffReviewSummaryUseCase(dependencies).execute(id),
    tallyOf: (repository) => repository.staffTally,
    answering: (answer) => ({ staffTally: vi.fn(async () => answer) }),
    id: STAFF_MEMBER_ID,
    field: 'staffId',
    message: 'Invalid staff ID',
    notFound: DomainErrors.notFound('Staff member', STAFF_MEMBER_ID),
  },
]

describe.each(summaries)(
  '$name',
  ({ summarize, tallyOf, answering, id, field, message, notFound }) => {
    it('returns what the reviews come to', async () => {
      const dependencies = reviewDependencies()

      expect(await summarize(dependencies, id)).toEqual({
        type: 'success',
        data: summary,
      })
      expect(tallyOf(dependencies.reviewRepository)).toHaveBeenCalledWith(id)
    })

    it('looks for it by its ID in lower case', async () => {
      const dependencies = reviewDependencies()

      await summarize(dependencies, id.toUpperCase())

      expect(tallyOf(dependencies.reviewRepository)).toHaveBeenCalledWith(id)
    })

    it('refuses an ID that is not a UUID, under the name of the path, without asking the repository', async () => {
      const dependencies = reviewDependencies()

      const summarized = await summarize(dependencies, 'all')

      expect(rulesOf(summarized)).toEqual([`${field}:invalid_format`])
      expect(validationMessageOf(summarized)).toBe(message)
      repositoryWasNotCalled(dependencies)
    })

    it('answers one that is not there, or deleted, as not found', async () => {
      const dependencies = reviewDependencies(answering(Result.success(null)))

      expect(await summarize(dependencies, id)).toEqual({
        type: 'error',
        error: notFound,
      })
    })

    it('returns no average when there are no reviews', async () => {
      const dependencies = reviewDependencies(
        answering(
          Result.success(
            reviewTally({
              averageRating: null,
              totalReviews: 0,
              ratingCounts: [0, 0, 0, 0, 0],
            }),
          ),
        ),
      )

      expect(await summarize(dependencies, id)).toEqual({
        type: 'success',
        data: {
          averageRating: null,
          totalReviews: 0,
          ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        },
      })
    })

    it('fails on an average that is not a number', async () => {
      const dependencies = reviewDependencies(
        answering(Result.success(reviewTally({ averageRating: 'four' }))),
      )

      expect(await summarize(dependencies, id)).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
    })

    it('passes a failure of the database on', async () => {
      const dependencies = reviewDependencies(answering(databaseDown))

      expect(await summarize(dependencies, id)).toEqual(databaseDown)
    })
  },
)
