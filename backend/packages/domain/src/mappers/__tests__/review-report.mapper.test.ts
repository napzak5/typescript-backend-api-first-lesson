import { describe, expect, it } from 'vitest'
import { USER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  apiReviewReport,
  dbReviewReport,
  OTHER_REVIEW_REPORT_ID,
  REVIEW_ID,
  REVIEW_REPORT_ID,
} from '../../__tests__/fixtures/review-fixtures'
import {
  type ApiReviewReportRequest,
  reviewReportIdSchema,
} from '../../models/review-report'
import { reviewReportSearchRequestSchema } from '../../schemas/review-report.schema'
import { ReviewReportReadMapper } from '../read/review-report.mapper'
import { ReviewReportWriteMapper } from '../write/review-report.mapper'

/** What a stored report that does not fit the model is answered with. */
const storedRowIsCorrupt = (id: string) => ({
  type: 'error',
  error: expect.objectContaining({
    type: 'database',
    message: `Stored review report ${id} does not match the API model`,
  }),
})

describe('ReviewReportReadMapper.toApiReviewReport', () => {
  it('returns every column under its own name, the times in ISO 8601', () => {
    expect(ReviewReportReadMapper.toApiReviewReport(dbReviewReport())).toEqual({
      type: 'success',
      data: apiReviewReport(),
    })
  })

  it('returns a dismissed report with who dismissed it, and when', () => {
    expect(
      ReviewReportReadMapper.toApiReviewReport(
        dbReviewReport({
          status: 'dismissed',
          resolvedBy: USER_ID,
          resolvedAt: '2026-11-22 09:30:00+09',
          updatedAt: '2026-11-22 09:30:00+09',
        }),
      ),
    ).toEqual({
      type: 'success',
      data: apiReviewReport({
        status: 'dismissed',
        resolvedBy: USER_ID,
        resolvedAt: '2026-11-22T00:30:00.000Z',
        updatedAt: '2026-11-22T00:30:00.000Z',
      }),
    })
  })

  it.each<[string, Parameters<typeof dbReviewReport>[0]]>([
    ['it was written', { createdAt: 'then' }],
    ['it was changed', { updatedAt: 'then' }],
    ['it was dismissed', { resolvedAt: 'then' }],
  ])('fails on a stored time that is not one: when %s', (_named, times) => {
    expect(
      ReviewReportReadMapper.toApiReviewReport(dbReviewReport(times)),
    ).toEqual(storedRowIsCorrupt(REVIEW_REPORT_ID))
  })
})

describe('ReviewReportReadMapper.toApiReviewReports', () => {
  it('returns the reports in their order', () => {
    expect(
      ReviewReportReadMapper.toApiReviewReports([
        dbReviewReport({ id: OTHER_REVIEW_REPORT_ID }),
        dbReviewReport(),
      ]),
    ).toEqual({
      type: 'success',
      data: [
        apiReviewReport({ id: OTHER_REVIEW_REPORT_ID }),
        apiReviewReport(),
      ],
    })
  })

  it('returns no reports for none', () => {
    expect(ReviewReportReadMapper.toApiReviewReports([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('fails on the first report that does not match the API model', () => {
    expect(
      ReviewReportReadMapper.toApiReviewReports([
        dbReviewReport(),
        dbReviewReport({ id: OTHER_REVIEW_REPORT_ID, createdAt: 'never' }),
      ]),
    ).toEqual(storedRowIsCorrupt(OTHER_REVIEW_REPORT_ID))
  })
})

describe('ReviewReportReadMapper.toApiReviewReportPage', () => {
  const paging = {
    limit: 2,
    after: reviewReportIdSchema.parse(REVIEW_REPORT_ID),
  }

  it('answers with the reports, the counts of the list and the place of the page', () => {
    expect(
      ReviewReportReadMapper.toApiReviewReportPage(
        {
          reports: [
            dbReviewReport({ id: OTHER_REVIEW_REPORT_ID }),
            dbReviewReport(),
          ],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toEqual({
      type: 'success',
      data: {
        data: [
          apiReviewReport({ id: OTHER_REVIEW_REPORT_ID }),
          apiReviewReport(),
        ],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: REVIEW_REPORT_ID,
          nextCursor: REVIEW_REPORT_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      ReviewReportReadMapper.toApiReviewReportPage(
        { reports: [dbReviewReport()], total: 1, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
  })

  it('fails on the first report that does not match the API model', () => {
    expect(
      ReviewReportReadMapper.toApiReviewReportPage(
        {
          reports: [
            dbReviewReport(),
            dbReviewReport({ id: OTHER_REVIEW_REPORT_ID, updatedAt: 'never' }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toEqual(storedRowIsCorrupt(OTHER_REVIEW_REPORT_ID))
  })
})

describe('ReviewReportWriteMapper', () => {
  it.each<[string, ApiReviewReportRequest]>([
    [
      'a reason of the list, without details',
      { reason: 'spam', details: null },
    ],
    [
      'a reason of the list, with details',
      { reason: 'false_information', details: 'Not a visit of that day' },
    ],
    [
      'another reason, which the details say',
      { reason: 'other', details: 'Written by a competitor' },
    ],
  ])(
    'returns a report request as the report it asks for: %s',
    (_named, request) => {
      expect(ReviewReportWriteMapper.fromReportRequest(request)).toStrictEqual(
        request,
      )
    },
  )
})

describe('ReviewReportWriteMapper.fromSearchRequest', () => {
  const unfiltered = { status: null, reviewId: null, salonId: null }

  it('lists the first 20 reports when the request names nothing', () => {
    expect(
      ReviewReportWriteMapper.fromSearchRequest(
        reviewReportSearchRequestSchema.parse({}),
      ),
    ).toStrictEqual({ limit: 20, after: null, ...unfiltered })
  })

  it('takes the place of the page and every filter the request names', () => {
    expect(
      ReviewReportWriteMapper.fromSearchRequest(
        reviewReportSearchRequestSchema.parse({
          limit: 5,
          cursor: REVIEW_REPORT_ID,
          status: 'dismissed',
          reviewId: REVIEW_ID,
          salonId: SALON_ID,
        }),
      ),
    ).toStrictEqual({
      limit: 5,
      after: REVIEW_REPORT_ID,
      status: 'dismissed',
      reviewId: REVIEW_ID,
      salonId: SALON_ID,
    })
  })

  it.each<[string, Record<string, string>]>([
    ['the status', { status: 'pending' }],
    ['the review', { reviewId: REVIEW_ID }],
    ['the salon', { salonId: SALON_ID }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      ReviewReportWriteMapper.fromSearchRequest(
        reviewReportSearchRequestSchema.parse(filter),
      ),
    ).toStrictEqual({ limit: 20, after: null, ...unfiltered, ...filter })
  })
})
