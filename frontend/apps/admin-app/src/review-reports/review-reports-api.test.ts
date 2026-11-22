import {
  answering,
  asked,
  page,
  problem,
  record,
  sent,
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
    const fetched = answering(() => page(REPORTS, 'next', 23))

    // Act
    const read = await readReportPage(
      salon.id,
      { status: 'pending', reviewId: waitingReport.reviewId },
      'cursor',
    )

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: REPORTS,
      total: 23,
      nextCursor: 'next',
    })
    expect(asked(fetched)).toEqual([
      `GET /review-reports?cursor=cursor&limit=20&reviewId=${waitingReport.reviewId}&salonId=${salon.id}&status=pending`,
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
    const read = await readReportPage(salon.id, {}, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('dismissReport', () => {
  it('should dismiss the report by its ID, and hand over the report as it is now', async () => {
    // Arrange
    const fetched = answering(() => record(200, dismissedReport))

    // Act
    const dismissal = await dismissReport(waitingReport.id)

    // Assert
    expect(dismissal).toEqual({ type: 'dismissed', report: dismissedReport })
    expect(asked(fetched)).toEqual([
      `POST /review-reports/${waitingReport.id}/dismiss`,
    ])
    expect(await sent(fetched)).toEqual([])
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
