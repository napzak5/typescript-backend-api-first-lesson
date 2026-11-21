import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../bookings/components/examples'
import { dismissedReport, REPORTS, waitingReport } from './components/examples'
import {
  dismissReport,
  readReportPage,
  reviewReportsKeyOf,
} from './review-reports-api'

/*
 * What the API answers to the reports is met with the real API
 * (`review-reports.integration.test.tsx`). Here are the answers a test
 * cannot bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The methods, the paths, the queries and the bodies of the requests that were sent */
const askedOf = (fetched: ReturnType<typeof answering>) =>
  Promise.all(
    fetched.mock.calls.map(async ([asked, init]) => {
      const request = new Request(asked, init)
      const url = new URL(request.url)
      const body = await request.text()

      return [
        request.method,
        url.pathname,
        Object.fromEntries(url.searchParams),
        body === '' ? null : JSON.parse(body),
      ]
    }),
  )

describe('reviewReportsKeyOf', () => {
  it('should read the reports below the salon', () => {
    expect(reviewReportsKeyOf(salon.id)).toEqual([
      'salons',
      salon.id,
      'review-reports',
    ])
  })
})

describe('readReportPage', () => {
  it('should ask for a page of twenty reports of the salon, of a state and of a review, after the cursor', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: REPORTS,
        meta: { total: 23, nextCursor: 'next', prevCursor: null },
        links: null,
      }),
    )

    // Act
    const page = await readReportPage(
      salon.id,
      { status: 'pending', reviewId: waitingReport.reviewId },
      'cursor',
    )

    // Assert
    expect(page).toEqual({
      type: 'found',
      items: REPORTS,
      total: 23,
      nextCursor: 'next',
    })
    expect(await askedOf(fetched)).toEqual([
      [
        'GET',
        '/api/v1/review-reports',
        {
          salonId: salon.id,
          status: 'pending',
          reviewId: waitingReport.reviewId,
          cursor: 'cursor',
          limit: '20',
        },
        null,
      ],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a cursor of a report that went meanwhile', () => problem(400), 'failed'],
    ['an account that is not an administrator', () => problem(403), 'failed'],
    ...UNREAD,
  ])('should read no reports after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const page = await readReportPage(salon.id, {}, undefined)

    // Assert
    expect(page).toEqual({ type })
  })
})

describe('dismissReport', () => {
  it('should dismiss the report by its ID, and hand over the report as it is now', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: dismissedReport, meta: null, links: null }),
    )

    // Act
    const dismissal = await dismissReport(waitingReport.id)

    // Assert
    expect(dismissal).toEqual({ type: 'dismissed', report: dismissedReport })
    expect(await askedOf(fetched)).toEqual([
      ['POST', `/api/v1/review-reports/${waitingReport.id}/dismiss`, {}, null],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a dismissal before', () => problem(409), 'dismissedAlready'],
    ['a report that went meanwhile', () => problem(404), 'notFound'],
    ['the account', () => problem(403), 'forbidden'],
    ['an ID that is none', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should dismiss nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const dismissal = await dismissReport(waitingReport.id)

    // Assert
    expect(dismissal).toEqual({ type })
  })
})
