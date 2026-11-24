import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { waitingReport } from '../examples'
import * as reportTableStories from './report-table.stories'

const stories = composeStories(reportTableStories)

describe('ReportTable', () => {
  it('should list each report with when it came, its review, why, what was written and its state', async () => {
    // Act
    await stories.OfTheSalon.run()

    // Assert
    expect(rowsOf('通報')).toEqual([
      [
        '2026年11月20日（金） 08:45',
        '評価 3 のレビュー',
        '宣伝や、来店と関係のない内容',
        '記録なし',
        '却下2026年11月21日（土） 09:15に却下',
      ],
      [
        '2026年11月20日（金） 10:30',
        '評価 3 のレビュー',
        '事実と違う内容',
        '記録なし',
        '未処理',
      ],
      [
        '2026年11月20日（金） 14:10',
        'ヘッドスパが気持ちよかった',
        'その他',
        '来店の記録がない日付のレビューです。\n予約台帳で確かめましたが、該当する予約がありません。',
        '未処理',
      ],
    ])
    expect(
      screen.getByRole('rowheader', { name: '2026年11月20日（金） 10:30' }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('link', { name: '評価 3 のレビュー' })[0],
    ).toHaveAttribute(
      'href',
      `/salons/${salon.id}/reviews/${waitingReport.reviewId}`,
    )
    expect(
      screen.queryByRole('button', { name: /却下する$/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('3 件')).toBeInTheDocument()
  })

  it('should offer the reports that come next', async () => {
    // Arrange
    const onMore = vi.fn()
    await stories.More.run({ args: { ...stories.More.args, onMore } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(
      screen.getByText('23 件（2 件を表示しています）'),
    ).toBeInTheDocument()
    expect(onMore).toHaveBeenCalledOnce()
  })

  it('should name no review, and dismiss a report that waits from its row', async () => {
    // Arrange
    const onDismiss = vi.fn()
    await stories.OfOneReview.run({
      args: { ...stories.OfOneReview.args, onDismiss },
    })

    // Act
    await userEvent.click(
      screen.getByRole('button', {
        name: '2026年11月20日（金） 10:30に受け付けた通報を却下する',
      }),
    )

    // Assert
    expect(
      within(screen.getByRole('table', { name: 'このレビューへの通報' }))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['受け付けた日時', '理由', '詳しい内容', '状態', '却下'])
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /却下する$/ })).toHaveLength(2)
    expect(screen.getByText('済み')).toBeInTheDocument()
    expect(onDismiss).toHaveBeenCalledWith(waitingReport)
  })

  itShouldBeAccessibleInEveryStory(stories)
})

describe('ReportTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list each report with when it came, its review, why and its state, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.OfTheSalon.run()

    // Assert
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Received', 'Review', 'Reason', 'Details', 'Status'])
    expect(rowsOf('通報')).toEqual([
      [
        'Fri, November 20, 2026 at 08:45',
        'Review rated 3',
        'Advertising, or something that has nothing to do with a visit',
        'Not recorded',
        'DismissedDismissed on Sat, November 21, 2026 at 09:15',
      ],
      [
        'Fri, November 20, 2026 at 10:30',
        'Review rated 3',
        'Something that is not true',
        'Not recorded',
        'Pending',
      ],
      [
        'Fri, November 20, 2026 at 14:10',
        'ヘッドスパが気持ちよかった',
        'Other',
        '来店の記録がない日付のレビューです。\n予約台帳で確かめましたが、該当する予約がありません。',
        'Pending',
      ],
    ])
    expect(screen.getByText('3 items')).toBeInTheDocument()
  })

  it('should dismiss a report that waits from its row, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.OfOneReview.run()

    // Assert
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Received', 'Reason', 'Details', 'Status', 'Dismissal'])
    expect(
      screen.getByRole('button', {
        name: 'Dismiss the report received on Fri, November 20, 2026 at 10:30',
      }),
    ).toHaveTextContent('Dismiss')
    expect(screen.getByText('Done')).toBeInTheDocument()
  })
})
