import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  goBack,
  heading,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../__tests__/screens'
import { refuse } from '../bookings/__tests__/arrangements'
import { reviewHrefOf, reviewReportsHrefOf, reviewsHrefOf } from '../navigation'
import {
  reviewIdOf,
  reviewRemovedMeanwhile,
  storedReviewOf,
} from '../reviews/__tests__/arrangements'
import {
  reportsDismissedMeanwhile,
  reviewsKeptOf,
  storedReportStatesOf,
} from './__tests__/arrangements'
import { reportMomentOf } from './review-reports'

/*
 * The reports of reviews against the API: the list of a salon, which
 * an administrator narrows by their state, and the reports of a review on
 * its screen, which the administrator dismisses, or removes the review
 * with them. The reports of the seed data are in `__tests__/arrangements.ts`.
 */

const GREAT = 'Great experience'
const EXCELLENT = 'Excellent service!'
const DETAILS = '担当したスタッフの名前が違います。'
const COMMENT =
  'Really enjoyed my visit. The stylist understood exactly what I wanted.'

/** The report of a review of the seed data, with its moments as the screens say them */
const reportOf = async (title: string) => {
  const [report] = await storedReportStatesOf(title)
  if (report === undefined) {
    throw new Error(`No report of ${title}`)
  }

  return {
    ...report,
    received: reportMomentOf(report.createdAt, report.timezone),
    dismissed:
      report.resolvedAt === null
        ? ''
        : `却下${reportMomentOf(report.resolvedAt, report.timezone)}に却下`,
  }
}

/** The cells of the rows of a table, row by row */
const rowsOf = (name: string): string[][] =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent ?? ''))

/** Opens a review of the salon in Osaka, and waits for its reports. */
const openReviewAs = async (email: string, title = GREAT): Promise<void> => {
  await openAs(
    reviewHrefOf(await salonIdOf(OSAKA), await reviewIdOf(title)),
    email,
  )
  await heading(title)
}

/** Each term of the record of the review with its description */
const detailsOf = (): string[][] => {
  const record = screen.getByRole('region', { name: 'レビュー' })
  const descriptions = within(record).getAllByRole('definition')

  return within(record)
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

const reportsPart = (): HTMLElement =>
  screen.getByRole('region', { name: '通報' })

const removalPart = (): HTMLElement =>
  screen.getByRole('region', { name: 'レビューの削除' })

/** Opens the dialog of the dismissal of the report that waits, from its row. */
const askToDismiss = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  const { received } = await reportOf(GREAT)
  await user.click(
    await within(reportsPart()).findByRole('button', {
      name: `${received}に受け付けた通報を却下する`,
    }),
  )

  return screen.getByRole('dialog', { name: '通報を却下しますか？' })
}

/** Opens the dialog of the removal of the review. */
const askToRemove = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(
    within(removalPart()).getByRole('button', { name: 'レビューを削除する' }),
  )

  return screen.getByRole('dialog', { name: `「${GREAT}」を削除しますか？` })
}

describe('the reports of reviews', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead an administrator from the reviews to the reports that wait, and from a report to its review', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(OSAKA)
    const { received } = await reportOf(GREAT)
    await openAs(reviewsHrefOf(salonId), OPERATOR)
    await heading('レビュー')

    // Act
    await user.click(await screen.findByRole('link', { name: '通報を見る' }))

    // Assert
    await heading('レビューへの通報')
    expect(firstSight()[0]).toBe(reviewReportsHrefOf(salonId))
    await screen.findByRole('table', { name: '未処理の通報' })
    await waitFor(() =>
      expect(rowsOf('未処理の通報')).toEqual([
        [received, GREAT, '事実と違う内容', DETAILS, '未処理'],
      ]),
    )
    expect(screen.getByRole('combobox', { name: '状態' })).toHaveValue(
      'pending',
    )

    // Act
    await user.click(screen.getByRole('link', { name: GREAT }))

    // Assert
    await heading(GREAT)
    // The review the row was named by is shown at once
    expect(firstSight()[1]).toContain(COMMENT)
    await within(reportsPart()).findByRole('table', {
      name: 'このレビューへの通報',
    })
    expect(rowsOf('このレビューへの通報')).toEqual([
      [received, '事実と違う内容', DETAILS, '未処理', '却下する'],
    ])
    expect(
      within(removalPart()).getByRole('button', {
        name: 'レビューを削除する',
      }),
    ).toBeVisible()
  })

  it('should let an administrator dismiss a report that waits, and count it no more', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(OSAKA)
    const { received } = await reportOf(GREAT)
    await openAs(reviewsHrefOf(salonId), OPERATOR)
    await screen.findByRole('link', { name: GREAT })
    await user.click(screen.getByRole('link', { name: '通報を見る' }))
    await user.click(await screen.findByRole('link', { name: GREAT }))
    await heading(GREAT)
    const dialog = await askToDismiss(user)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '却下する' }))

    // Assert
    expect(await screen.findByText('通報を却下しました。')).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    const report = await reportOf(GREAT)
    expect(report).toMatchObject({ status: 'dismissed', resolvedBy: OPERATOR })
    expect((await storedReviewOf(GREAT)).reportCount).toBe(0)
    await waitFor(() =>
      expect(rowsOf('このレビューへの通報')).toEqual([
        [received, '事実と違う内容', DETAILS, report.dismissed, '済み'],
      ]),
    )
    await waitFor(() =>
      expect(
        within(reportsPart()).getByRole('heading', { name: '通報' }),
      ).toHaveFocus(),
    )
    await waitFor(() =>
      expect(detailsOf()).toContainEqual(['未処理の通報', 'なし']),
    )

    // Act
    await user.click(screen.getByRole('link', { name: 'レビューへ' }))

    // Assert: the reviews that counted the report are read anew, not shown as they were
    await heading('レビュー')
    expect(firstSight()).toEqual([
      reviewsHrefOf(salonId),
      expect.not.stringContaining(GREAT),
    ])

    // Act
    await user.click(await screen.findByRole('link', { name: '通報を見る' }))

    // Assert: so are the reports that wait
    await heading('レビューへの通報')
    expect(firstSight()).toEqual([
      reviewReportsHrefOf(salonId),
      expect.not.stringContaining(DETAILS),
    ])
    expect(await screen.findByText('未処理の通報はありません')).toBeVisible()
  })

  it('should read the reports anew when the same state is shown again', async () => {
    // Arrange
    const user = userEvent.setup()
    const address = reviewReportsHrefOf(await salonIdOf(OSAKA))
    await openAs(address, OPERATOR)
    await screen.findByRole('link', { name: GREAT })
    await reportsDismissedMeanwhile(GREAT, OPERATOR)

    // Act
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(await screen.findByText('未処理の通報はありません')).toBeVisible()
    expect(firstSight()[0]).toBe(address)
  })

  it('should narrow the reports of a salon by their state, and keep the state in the address', async () => {
    // Arrange
    const user = userEvent.setup()
    const address = reviewReportsHrefOf(await salonIdOf(TOKYO))
    const { received, dismissed } = await reportOf(EXCELLENT)
    await openAs(address, OPERATOR)
    expect(await screen.findByText('未処理の通報はありません')).toBeVisible()
    const state = screen.getByRole('combobox', { name: '状態' })

    // Act
    await user.selectOptions(state, 'all')
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await screen.findByRole('table', { name: '通報' })
    expect(firstSight()[0]).toBe(`${address}?status=all`)
    await waitFor(() =>
      expect(rowsOf('通報')).toEqual([
        [
          received,
          EXCELLENT,
          '宣伝や、来店と関係のない内容',
          '記録なし',
          dismissed,
        ],
      ]),
    )

    // Act
    await user.selectOptions(state, 'dismissed')
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await screen.findByRole('table', { name: '却下した通報' })
    expect(firstSight()[0]).toBe(`${address}?status=dismissed`)
    expect(rowsOf('却下した通報')).toEqual([
      [
        received,
        EXCELLENT,
        '宣伝や、来店と関係のない内容',
        '記録なし',
        dismissed,
      ],
    ])

    // Act
    await user.selectOptions(state, 'pending')
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(await screen.findByText('未処理の通報はありません')).toBeVisible()
    expect(firstSight()[0]).toBe(address)
  })

  it('should say that another administrator dismissed the report meanwhile, and show it dismissed', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(OPERATOR)
    const dialog = await askToDismiss(user)
    await reportsDismissedMeanwhile(GREAT, OPERATOR)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '却下する' }))

    // Assert
    expect(
      await within(reportsPart()).findByText(
        'この通報は、その間に、ほかの管理者が却下しました。却下は、1 つの通報に 1 回です。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    const { received, dismissed } = await reportOf(GREAT)
    await waitFor(() =>
      expect(rowsOf('このレビューへの通報')).toEqual([
        [received, '事実と違う内容', DETAILS, dismissed, '済み'],
      ]),
    )
    await waitFor(() =>
      expect(
        within(reportsPart()).getByRole('heading', { name: '通報' }),
      ).toHaveFocus(),
    )
  })

  it('should say in the dialog that the report could not be dismissed when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(OPERATOR)
    const dialog = await askToDismiss(user)
    await refuse('update', 'review_reports')

    // Act
    await user.click(within(dialog).getByRole('button', { name: '却下する' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '通報を却下できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should say that the review is gone when it was removed before its report was dismissed', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(OPERATOR)
    const dialog = await askToDismiss(user)
    await reviewRemovedMeanwhile(GREAT)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '却下する' }))

    // Assert
    expect(await heading('レビューが見つかりません')).toBeVisible()
  })

  it('should let an administrator remove a review that breaks the rules, with its reports, and go back to the reviews', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(OSAKA)
    await openAs(reviewsHrefOf(salonId), OPERATOR)
    await screen.findByRole('link', { name: GREAT })
    await user.click(screen.getByRole('link', { name: '通報を見る' }))
    await user.click(await screen.findByRole('link', { name: GREAT }))
    await within(reportsPart()).findByRole('table', {
      name: 'このレビューへの通報',
    })
    const dialog = await askToRemove(user)
    expect(dialog).toHaveAccessibleDescription(
      '削除したレビューは、元に戻せません。このレビューへの通報も、一緒に消えます。',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText(
        'レビューを削除しました。通報も、一緒に削除しました。',
      ),
    ).toBeVisible()
    await heading('レビュー')
    expect(firstSight()).toEqual([
      reviewsHrefOf(salonId),
      expect.not.stringContaining(GREAT),
    ])
    const table = await screen.findByRole('table', { name: 'レビュー' })
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map(({ textContent }) => textContent),
    ).not.toContain(GREAT)
    expect(await reviewsKeptOf(GREAT)).toBe(0)
    expect(await storedReportStatesOf(GREAT)).toEqual([])

    // Act
    await act(() => goBack())

    // Assert: the review is gone at once
    expect(firstSight()[1]).toContain('レビューが見つかりません')

    // Act
    await user.click(await screen.findByRole('link', { name: 'レビューへ' }))
    await user.click(await screen.findByRole('link', { name: '通報を見る' }))

    // Assert: the reports of the review went with it, whatever the review is called
    await heading('レビューへの通報')
    expect(firstSight()[1]).not.toContain(DETAILS)
    expect(await screen.findByText('未処理の通報はありません')).toBeVisible()
  })

  it('should say that the review is gone when it was removed before the administrator removed it', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(OPERATOR)
    const dialog = await askToRemove(user)
    await reviewRemovedMeanwhile(GREAT)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await heading('レビューが見つかりません')).toBeVisible()
  })

  it('should say in the dialog that the review could not be removed when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(OPERATOR)
    const dialog = await askToRemove(user)
    await refuse('delete', 'reviews')

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'レビューを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(await reviewsKeptOf(GREAT)).toBe(1)
  })

  it.each<[string]>([[OWNER], [MANAGER], [STYLIST]])(
    'should tell %s who handles the reports, without reading them',
    async (email) => {
      // Arrange
      const fetched = vi.spyOn(globalThis, 'fetch')
      await openAs(reviewReportsHrefOf(await salonIdOf(TOKYO)), email)

      // Assert
      expect(
        await screen.findByText(
          'このアカウントでは、通報を扱えません。通報を確かめて、却下するか、レビューを削除するのは、管理者です。',
        ),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: 'レビューへ' })).toHaveAttribute(
        'href',
        reviewsHrefOf(await salonIdOf(TOKYO)),
      )
      expect(
        fetched.mock.calls.map(([asked]) => new Request(asked).url),
      ).not.toContainEqual(expect.stringContaining('/review-reports'))
    },
  )

  it('should offer an owner neither the reports nor the removal of a review', async () => {
    // Arrange
    await openAs(reviewsHrefOf(await salonIdOf(TOKYO)), OWNER)
    await screen.findByRole('table', { name: 'レビュー' })

    // Assert
    expect(screen.queryByRole('link', { name: '通報を見る' })).toBeNull()

    // Act
    await userEvent.click(screen.getByRole('link', { name: EXCELLENT }))

    // Assert
    await heading(EXCELLENT)
    await screen.findByRole('region', { name: 'サロンからの返信' })
    expect(screen.queryByRole('region', { name: '通報' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'レビューの削除' })).toBeNull()
  })

  it.each<[string, () => Promise<string>, () => Promise<unknown>]>([
    [
      'the reports that wait',
      async () => reviewReportsHrefOf(await salonIdOf(OSAKA)),
      () => screen.findByRole('link', { name: GREAT }),
    ],
    [
      'every report',
      async () => `${reviewReportsHrefOf(await salonIdOf(TOKYO))}?status=all`,
      () => screen.findByRole('link', { name: EXCELLENT }),
    ],
    [
      'a review with its reports',
      async () => reviewHrefOf(await salonIdOf(OSAKA), await reviewIdOf(GREAT)),
      () => screen.findByRole('table', { name: 'このレビューへの通報' }),
    ],
    [
      'the dialog of a dismissal',
      async () => reviewHrefOf(await salonIdOf(OSAKA), await reviewIdOf(GREAT)),
      async () => {
        await screen.findByRole('table', { name: 'このレビューへの通報' })
        return askToDismiss(userEvent.setup())
      },
    ],
    [
      'the dialog of a removal',
      async () => reviewHrefOf(await salonIdOf(OSAKA), await reviewIdOf(GREAT)),
      async () => {
        await screen.findByRole('table', { name: 'このレビューへの通報' })
        return askToRemove(userEvent.setup())
      },
    ],
  ])('should show %s accessibly', async (_, pathOf, opened) => {
    // Arrange
    await openAs(await pathOf(), OPERATOR)
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})
