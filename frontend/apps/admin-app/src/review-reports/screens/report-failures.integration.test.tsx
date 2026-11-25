import {
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import { OPERATOR, OSAKA } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import { reviewReportsHrefOf } from '../../navigation'
import {
  reviewIdOf,
  reviewRemovedMeanwhile,
} from '../../reviews/__tests__/arrangements'
import { reviewAt } from '../../reviews/__tests__/screens'
import {
  lastReportOf,
  reportedByMany,
  reviewsKeptOf,
} from '../__tests__/arrangements'
import {
  askToRemove,
  GREAT,
  openReviewAs,
  removalPart,
  reportsPart,
} from '../__tests__/screens'

/*
 * The reports of reviews, when a read fails, when the review of a report
 * is gone or cannot be read, and when the role of the administrator
 * changed meanwhile. The failures are arranged in the database; what goes
 * well is in `review-reports.integration.test.tsx`.
 */

const GOOD = 'Good but could be better'

const REPORTS_UNREAD =
  '通報を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

const PENDING = '未処理の通報'
const OF_THE_REVIEW = 'このレビューへの通報'

/** Opens the reports of the salon in Osaka that wait, as the administrator. */
const openReports = async (): Promise<void> => {
  await openAs(reviewReportsHrefOf(await salonIdOf(OSAKA)), OPERATOR)
  await heading('レビューへの通報')
}

/** What the row of the report of the seed data names its review by */
const reviewNamed = (): string | null | undefined => rowsOf(PENDING)[0]?.[1]

describe('the reports of reviews, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the reports could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'review_reports',
      'updatedAt',
      await lastReportOf(GREAT),
    )
    await openReports()
    expect(await screen.findByText(REPORTS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await screen.findByRole('table', { name: PENDING })
    expect(rowsOf(PENDING)).toHaveLength(1)
  })

  it('should say that the reports that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await reportedByMany(GREAT, 21)
    const readable = await unreadable(
      'review_reports',
      'updatedAt',
      await lastReportOf(GREAT),
    )
    await openReports()
    await screen.findByRole('table', { name: PENDING })
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await waitFor(() => {
      expect(rowsOf(PENDING)).toHaveLength(22)
    })
  })

  it('should name the review of a report as removed when it was removed as the reports were read', async () => {
    // Arrange
    whenAskedFor(`GET /reviews/${await reviewIdOf(GREAT)}`, () =>
      reviewRemovedMeanwhile(GREAT),
    )

    // Act
    await openReports()

    // Assert
    await screen.findByRole('table', { name: PENDING })
    await waitFor(() => {
      expect(reviewNamed()).toBe('削除されたレビュー')
    })
  })

  it('should say of the review of a report that its title could not be read', async () => {
    // Arrange
    await unreadable('reviews', 'updatedAt', await reviewIdOf(GREAT))

    // Act
    await openReports()

    // Assert
    await screen.findByRole('table', { name: PENDING })
    await waitFor(() => {
      expect(reviewNamed()).toBe('レビュー（題名を読めませんでした）')
    })
  })

  it('should say that the reports of a review could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'review_reports',
      'updatedAt',
      await lastReportOf(GREAT),
    )
    await openReviewAs(OPERATOR)
    expect(await within(reportsPart()).findByText(REPORTS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user, { inside: within(reportsPart()) })

    // Assert
    await within(reportsPart()).findByRole('table', { name: OF_THE_REVIEW })
    expect(rowsOf(OF_THE_REVIEW)).toHaveLength(1)
  })

  it('should say that the reports of a review that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await reportedByMany(GREAT, 21)
    const readable = await unreadable(
      'review_reports',
      'updatedAt',
      await lastReportOf(GREAT),
    )
    await openReviewAs(OPERATOR)
    await within(reportsPart()).findByRole('table', { name: OF_THE_REVIEW })
    await user.click(
      within(reportsPart()).getByRole('button', { name: 'さらに表示' }),
    )
    expect(await within(reportsPart()).findByText(REST_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user, { inside: within(reportsPart()) })

    // Assert
    await waitFor(() => {
      expect(rowsOf(OF_THE_REVIEW)).toHaveLength(22)
    })
  })

  it('should say that a review has no report', async () => {
    // Act
    await openAs(await reviewAt(GOOD), OPERATOR)

    // Assert
    expect(
      await within(
        await screen.findByRole('region', { name: '通報' }),
      ).findByText('このレビューへの通報はありません。'),
    ).toBeVisible()
  })

  it('should say why the review was kept when the account was no administrator any more as it removed the review', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(OPERATOR)
    const dialog = await askToRemove(user)
    await madeStaffMeanwhile(OPERATOR)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await within(removalPart()).findByRole('alert')).toHaveTextContent(
      'このアカウントでは、このレビューを削除できません。レビューを削除できるのは、書いたお客様と、管理者です。',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await reviewsKeptOf(GREAT)).toBe(1)
  })
})
