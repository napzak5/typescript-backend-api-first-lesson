import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { waitingReport } from '../examples'
import * as reportTableStories from './report-table.stories'

const stories = composeStories(reportTableStories)

/** The cells of the rows of the table, row by row */
const rowsOf = (caption: string): string[][] =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent ?? ''))

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
        'なし',
        '却下2026年11月21日（土） 09:15に却下',
      ],
      [
        '2026年11月20日（金） 10:30',
        '評価 3 のレビュー',
        '事実と違う内容',
        'なし',
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
