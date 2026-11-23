import { Result } from '@beauty-salon-backend/utility'
import { reviewReportMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiReviewReport,
  dbReviewReport,
  OTHER_REVIEW_ID,
  OTHER_REVIEW_REPORT_ID,
  REVIEW_ID,
  REVIEW_REPORT_ID,
  reviewDependencies,
  reviewReportDependencies,
} from '../../../__tests__/fixtures/review-fixtures'
import type { Actor } from '../../../models/auth'
import type { ReviewReporting } from '../../../repositories/review.repository'
import type {
  ReportDismissal,
  ReviewReportList,
} from '../../../repositories/review-report.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  ReportReviewUseCase,
  type ReviewUseCaseDependencies,
} from '../../review'
import {
  DismissReviewReportUseCase,
  ListReviewReportsUseCase,
  type ReviewReportUseCaseDependencies,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

const storedReportIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({
    type: 'database',
    message: `Stored review report ${REVIEW_REPORT_ID} does not match the API model`,
  }),
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

/** A report for a reason of the list, with what it is about. */
const reportRequest = {
  reason: 'false_information',
  details: '来店していない日の施術が書かれています。',
}

/** The accounts that do not handle the reports. */
const notAdministrators: [string, Actor][] = [
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

describe('ReportReviewUseCase', () => {
  const report = (
    dependencies: ReviewUseCaseDependencies,
    actor: Actor = actors.customer,
    id: unknown = REVIEW_ID,
    input: unknown = reportRequest,
  ) => new ReportReviewUseCase(dependencies).execute(actor, id, input)

  const reporting = (outcome: ReviewReporting) => ({
    report: vi.fn(async () => Result.success(outcome)),
  })

  const repositoryWasNotCalled = (dependencies: ReviewUseCaseDependencies) => {
    expect(
      vi.mocked(dependencies.reviewRepository.report),
    ).not.toHaveBeenCalled()
  }

  it('reports the review for the signed-in customer and returns the report', async () => {
    const dependencies = reviewDependencies()

    expect(await report(dependencies)).toEqual({
      type: 'success',
      data: apiReviewReport(),
    })
    expect(dependencies.reviewRepository.report).toHaveBeenCalledWith(
      REVIEW_ID,
      { type: 'customer', userId: USER_ID, customerId: CUSTOMER_ID },
      reportRequest,
    )
  })

  it.each(['owner', 'manager'] as const)(
    'reports the review for the %s of a salon, as their salon',
    async (role) => {
      const dependencies = reviewDependencies()

      expect(await report(dependencies, actors.ofSalon(role))).toEqual({
        type: 'success',
        data: apiReviewReport(),
      })
      expect(dependencies.reviewRepository.report).toHaveBeenCalledWith(
        REVIEW_ID,
        { type: 'salon', userId: USER_ID, salonId: SALON_ID },
        reportRequest,
      )
    },
  )

  it('looks for the review by its ID in lower case', async () => {
    const dependencies = reviewDependencies()

    await report(dependencies, actors.customer, REVIEW_ID.toUpperCase())

    expect(dependencies.reviewRepository.report).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.anything(),
      reportRequest,
    )
  })

  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['a staff member', actors.ofSalon('staff')],
    ['an account of a salon that reaches no salon', actors.withoutScope],
    ['a customer without a profile', actors.customerWithoutProfile],
  ])('refuses %s before the ID and the request are read', async (_, actor) => {
    const dependencies = reviewDependencies()

    expect(
      await report(dependencies, actor, 'not-a-uuid', { broken: true }),
    ).toEqual({ type: 'error', error: DomainErrors.forbidden() })
    repositoryWasNotCalled(dependencies)
  })

  it('refuses an ID that is not a UUID before the request is read', async () => {
    const dependencies = reviewDependencies()

    const reported = await report(dependencies, actors.customer, 'latest', {
      broken: true,
    })

    expect(rulesOf(reported)).toEqual(['id:invalid_format'])
    expect(validationMessageOf(reported)).toBe('Invalid review ID')
    repositoryWasNotCalled(dependencies)
  })

  it.each([
    'inappropriate',
    'false_information',
    'personal_information',
    'spam',
    'other',
  ])('takes the reason %s', async (reason) => {
    const dependencies = reviewDependencies()
    const request = { reason, details: '口コミと関係のない宣伝です。' }

    expect(
      await report(dependencies, actors.customer, REVIEW_ID, request),
    ).toEqual({ type: 'success', data: apiReviewReport() })
    expect(dependencies.reviewRepository.report).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.anything(),
      request,
    )
  })

  it('takes a report for a reason of the list without details', async () => {
    const dependencies = reviewDependencies()
    const request = { reason: 'spam', details: null }

    expect(
      await report(dependencies, actors.customer, REVIEW_ID, request),
    ).toMatchObject({ type: 'success' })
    expect(dependencies.reviewRepository.report).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.anything(),
      request,
    )
  })

  it('takes details of 2000 characters', async () => {
    const dependencies = reviewDependencies()
    const request = { reason: 'other', details: '𠮷'.repeat(2000) }

    expect(
      await report(dependencies, actors.customer, REVIEW_ID, request),
    ).toMatchObject({ type: 'success' })
  })

  it.each<[string, unknown, string[]]>([
    [
      'a reason that is not one of the list',
      { reason: 'rude', details: null },
      ['reason:invalid_value'],
    ],
    ['a request without a reason', { details: null }, ['reason:invalid_value']],
    ['a request without details', { reason: 'spam' }, ['details:invalid_type']],
    [
      'blank details',
      { reason: 'spam', details: ' \n\t　' },
      ['details:invalid_format'],
    ],
    [
      'details of more than 2000 characters',
      { reason: 'spam', details: 'あ'.repeat(2001) },
      ['details:too_big'],
    ],
    [
      'another reason without details',
      { reason: 'other', details: null },
      ['details:custom'],
    ],
    [
      'another reason with blank details',
      { reason: 'other', details: ' ' },
      ['details:invalid_format'],
    ],
    [
      'a property the request does not have',
      { ...reportRequest, status: 'dismissed' },
      ['status:unrecognized_keys'],
    ],
  ])('refuses %s without asking the repository', async (_, input, rules) => {
    const dependencies = reviewDependencies()

    const reported = await report(
      dependencies,
      actors.customer,
      REVIEW_ID,
      input,
    )

    expect(rulesOf(reported)).toEqual(rules)
    expect(validationMessageOf(reported)).toBe('Invalid review report')
    repositoryWasNotCalled(dependencies)
  })

  it('should say that a report for another reason says what it is about', async () => {
    // Arrange
    const dependencies = reviewDependencies()

    // Act
    const reported = await report(dependencies, actors.customer, REVIEW_ID, {
      reason: 'other',
      details: null,
    })

    // Assert
    expect(reported).toMatchObject({
      type: 'error',
      error: {
        issues: [
          { field: 'details', message: reviewReportMessages.detailsForOther },
        ],
      },
    })
  })

  it.each<[string, ReviewReporting, DomainError]>([
    [
      'a review that is not there, or of a deleted salon, as not found',
      { type: 'reviewNotFound' },
      DomainErrors.notFound('Review', REVIEW_ID),
    ],
    [
      'an account whose customer was deleted as forbidden',
      { type: 'reporterNotFound' },
      DomainErrors.forbidden(),
    ],
    [
      'the author as forbidden',
      { type: 'ownReview' },
      DomainErrors.forbidden(),
    ],
    [
      'a salon reporting a review of another salon as forbidden',
      { type: 'otherSalon' },
      DomainErrors.forbidden(),
    ],
    [
      'a second report of the account as a conflict',
      { type: 'reportedAlready' },
      DomainErrors.conflict(
        'The account has reported the review already; an account reports a review once',
      ),
    ],
  ])('answers %s', async (_, outcome, error) => {
    const dependencies = reviewDependencies(reporting(outcome))

    expect(await report(dependencies)).toEqual({ type: 'error', error })
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewDependencies({
      report: vi.fn(async () => databaseDown),
    })

    expect(await report(dependencies)).toEqual(databaseDown)
  })

  it('fails on a stored report that does not match the API model', async () => {
    const dependencies = reviewDependencies(
      reporting({
        type: 'reported',
        report: dbReviewReport({ createdAt: 'yesterday' }),
      }),
    )

    expect(await report(dependencies)).toEqual(storedReportIsCorrupt)
  })
})

describe('ListReviewReportsUseCase', () => {
  const list = (
    dependencies: ReviewReportUseCaseDependencies,
    actor: Actor = actors.admin,
    input: unknown = {},
  ) =>
    new ListReviewReportsUseCase(dependencies).execute(
      actor,
      Result.success(input),
    )

  const listing = (outcome: ReviewReportList | null) => ({
    list: vi.fn(async () => Result.success(outcome)),
  })

  const repositoryWasNotCalled = (
    dependencies: ReviewReportUseCaseDependencies,
  ) => {
    expect(
      vi.mocked(dependencies.reviewReportRepository.list),
    ).not.toHaveBeenCalled()
  }

  it('lists the reports for an administrator, 20 to a page, with every filter off', async () => {
    const dependencies = reviewReportDependencies()

    expect(await list(dependencies)).toEqual({
      type: 'success',
      data: {
        data: [apiReviewReport()],
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
    expect(dependencies.reviewReportRepository.list).toHaveBeenCalledWith({
      limit: 20,
      after: null,
      status: null,
      reviewId: null,
      salonId: null,
    })
  })

  it('hands the filters, the cursor and the size of the page on, the IDs in lower case', async () => {
    const dependencies = reviewReportDependencies()

    await list(dependencies, actors.admin, {
      limit: 5,
      cursor: OTHER_REVIEW_REPORT_ID.toUpperCase(),
      status: 'dismissed',
      reviewId: OTHER_REVIEW_ID.toUpperCase(),
      salonId: SALON_ID.toUpperCase(),
    })

    expect(dependencies.reviewReportRepository.list).toHaveBeenCalledWith({
      limit: 5,
      after: OTHER_REVIEW_REPORT_ID,
      status: 'dismissed',
      reviewId: OTHER_REVIEW_ID,
      salonId: SALON_ID,
    })
  })

  it('points the next page at the last report of a page that has one after it', async () => {
    const dependencies = reviewReportDependencies(
      listing({
        reports: [
          dbReviewReport({ id: OTHER_REVIEW_REPORT_ID }),
          dbReviewReport(),
        ],
        total: 5,
        hasMore: true,
      }),
    )

    expect(
      await list(dependencies, actors.admin, {
        limit: 2,
        cursor: OTHER_REVIEW_REPORT_ID,
      }),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: OTHER_REVIEW_REPORT_ID,
          nextCursor: REVIEW_REPORT_ID,
          prevCursor: null,
        },
      },
    })
  })

  it.each(notAdministrators)(
    'refuses %s before the search is read',
    async (_, actor) => {
      const dependencies = reviewReportDependencies()

      expect(await list(dependencies, actor, { limit: 0 })).toEqual({
        type: 'error',
        error: DomainErrors.forbidden(),
      })
      repositoryWasNotCalled(dependencies)
    },
  )

  it.each(notAdministrators)(
    'refuses %s even when the query could not be decoded',
    async (_, actor) => {
      const dependencies = reviewReportDependencies()
      const undecoded = Result.error(
        DomainErrors.validation(
          reviewReportMessages.invalidReviewReportSearch,
          [],
        ),
      )

      expect(
        await new ListReviewReportsUseCase(dependencies).execute(
          actor,
          undecoded,
        ),
      ).toEqual({ type: 'error', error: DomainErrors.forbidden() })
      repositoryWasNotCalled(dependencies)
    },
  )

  it('answers an administrator with the failure of decoding the query, without asking the repository', async () => {
    const dependencies = reviewReportDependencies()
    const undecoded = Result.error(
      DomainErrors.validation(reviewReportMessages.invalidReviewReportSearch, [
        { field: 'limit', rule: 'invalid_format', message: MADE_UP_MESSAGE },
      ]),
    )

    expect(
      await new ListReviewReportsUseCase(dependencies).execute(
        actors.admin,
        undecoded,
      ),
    ).toEqual(undecoded)
    repositoryWasNotCalled(dependencies)
  })

  it.each<[string, unknown, string[]]>([
    ['a page of no reports', { limit: 0 }, ['limit:too_small']],
    ['a page of more than 100 reports', { limit: 101 }, ['limit:too_big']],
    ['a page of part of a report', { limit: 2.5 }, ['limit:invalid_type']],
    [
      'a cursor that is not an ID',
      { cursor: 'next' },
      ['cursor:invalid_format'],
    ],
    ['a status there is not', { status: 'resolved' }, ['status:invalid_value']],
    [
      'a review ID that is not one',
      { reviewId: '42' },
      ['reviewId:invalid_format'],
    ],
    [
      'a salon ID that is not one',
      { salonId: '42' },
      ['salonId:invalid_format'],
    ],
    [
      'a parameter the search does not have',
      { sortBy: 'recent' },
      ['sortBy:unrecognized_keys'],
    ],
    [
      'every parameter stated without a value',
      {
        limit: undefined,
        cursor: undefined,
        status: undefined,
        reviewId: undefined,
        salonId: undefined,
      },
      [
        'limit:invalid_type',
        'cursor:invalid_type',
        'status:invalid_value',
        'reviewId:invalid_type',
        'salonId:invalid_type',
      ],
    ],
  ])('refuses %s without asking the repository', async (_, input, rules) => {
    const dependencies = reviewReportDependencies()

    const listed = await list(dependencies, actors.admin, input)

    expect(rulesOf(listed)).toEqual(rules)
    expect(validationMessageOf(listed)).toBe('Invalid review report search')
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a cursor that names no report that is listed', async () => {
    const dependencies = reviewReportDependencies(listing(null))

    expect(
      await list(dependencies, actors.admin, {
        cursor: OTHER_REVIEW_REPORT_ID,
      }),
    ).toEqual({
      type: 'error',
      error: DomainErrors.validation(
        reviewReportMessages.invalidReviewReportSearch,
        [
          {
            field: 'cursor',
            rule: 'not_found',
            message: reviewReportMessages.aListedReviewReport,
          },
        ],
      ),
    })
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewReportDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('fails on a stored report that does not match the API model', async () => {
    const dependencies = reviewReportDependencies(
      listing({
        reports: [dbReviewReport({ resolvedAt: 'never' })],
        total: 1,
        hasMore: false,
      }),
    )

    expect(await list(dependencies)).toEqual(storedReportIsCorrupt)
  })
})

describe('DismissReviewReportUseCase', () => {
  const dismiss = (
    dependencies: ReviewReportUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = REVIEW_REPORT_ID,
  ) => new DismissReviewReportUseCase(dependencies).execute(actor, id)

  const dismissing = (outcome: ReportDismissal) => ({
    dismiss: vi.fn(async () => Result.success(outcome)),
  })

  const repositoryWasNotCalled = (
    dependencies: ReviewReportUseCaseDependencies,
  ) => {
    expect(
      vi.mocked(dependencies.reviewReportRepository.dismiss),
    ).not.toHaveBeenCalled()
  }

  it('dismisses the report for the administrator and returns it', async () => {
    const dependencies = reviewReportDependencies()

    expect(await dismiss(dependencies)).toEqual({
      type: 'success',
      data: apiReviewReport({
        status: 'dismissed',
        resolvedBy: USER_ID,
        resolvedAt: '2026-11-22T00:30:00.000Z',
        updatedAt: '2026-11-22T00:30:00.000Z',
      }),
    })
    expect(dependencies.reviewReportRepository.dismiss).toHaveBeenCalledWith(
      REVIEW_REPORT_ID,
      USER_ID,
    )
  })

  it('looks for the report by its ID in lower case', async () => {
    const dependencies = reviewReportDependencies()

    await dismiss(dependencies, actors.admin, REVIEW_REPORT_ID.toUpperCase())

    expect(dependencies.reviewReportRepository.dismiss).toHaveBeenCalledWith(
      REVIEW_REPORT_ID,
      USER_ID,
    )
  })

  it.each(notAdministrators)(
    'refuses %s before the ID is read',
    async (_, actor) => {
      const dependencies = reviewReportDependencies()

      expect(await dismiss(dependencies, actor, 'not-a-uuid')).toEqual({
        type: 'error',
        error: DomainErrors.forbidden(),
      })
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses an ID that is not a UUID without asking the repository', async () => {
    const dependencies = reviewReportDependencies()

    const dismissed = await dismiss(dependencies, actors.admin, 'latest')

    expect(rulesOf(dismissed)).toEqual(['id:invalid_format'])
    expect(validationMessageOf(dismissed)).toBe('Invalid review report ID')
    repositoryWasNotCalled(dependencies)
  })

  it('answers a report that is not there, or of a review of a deleted salon, as not found', async () => {
    const dependencies = reviewReportDependencies(
      dismissing({ type: 'reportNotFound' }),
    )

    expect(await dismiss(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.notFound('ReviewReport', REVIEW_REPORT_ID),
    })
  })

  it('refuses a report dismissed already as a conflict', async () => {
    const dependencies = reviewReportDependencies(
      dismissing({ type: 'dismissedAlready' }),
    )

    expect(await dismiss(dependencies)).toEqual({
      type: 'error',
      error: DomainErrors.conflict(
        'The report is dismissed already; a report is dismissed once',
      ),
    })
  })

  it('passes a failure of the database on', async () => {
    const dependencies = reviewReportDependencies({
      dismiss: vi.fn(async () => databaseDown),
    })

    expect(await dismiss(dependencies)).toEqual(databaseDown)
  })

  it('fails on a stored report that does not match the API model', async () => {
    const dependencies = reviewReportDependencies(
      dismissing({
        type: 'dismissed',
        report: dbReviewReport({ updatedAt: 'now' }),
      }),
    )

    expect(await dismiss(dependencies)).toEqual(storedReportIsCorrupt)
  })
})
