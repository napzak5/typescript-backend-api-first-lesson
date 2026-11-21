import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { answeredReview } from '../examples'
import * as reviewTableStories from './review-table.stories'

const stories = composeStories(reviewTableStories)

/** The cells of the rows of the table, by their text */
const rows = (): string[][] =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent ?? ''))

describe('ReviewTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say of each review what it is called, when it was written at the salon, its rating and comment, whom it rates, whether it was answered and what reports wait', async () => {
    // Act
    await stories.Reviews.run()

    // Assert
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'レビュー',
      '投稿日',
      '評価',
      'コメント',
      '担当スタッフ',
      '返信',
      '通報',
    ])
    expect(rows()).toEqual([
      [
        '評価 3 のレビュー',
        '2026年11月20日（金）',
        '3.0',
        '予約していたのに 30 分待ちました。',
        '指名なし',
        '未返信',
        '未処理 1 件',
      ],
      [
        'ヘッドスパが気持ちよかった',
        '2026年11月19日（木）',
        '4.0',
        'なし',
        '佐藤 健',
        '未返信',
        'なし',
      ],
      [
        '仕上がりに大満足',
        '2026年11月18日（水）',
        '5.0',
        'カウンセリングが丁寧で、思っていた通りの色になりました。\nまたお願いします。',
        '田中 美咲',
        '返信済み',
        'なし',
      ],
    ])
    expect(
      screen
        .getAllByRole('img')
        .map((rating) => rating.getAttribute('aria-label')),
    ).toEqual(['5 段階中 3.0', '5 段階中 4.0', '5 段階中 5.0'])
    expect(
      screen.getByText(/^カウンセリングが丁寧で、/),
      'a comment keeps the lines it was written in',
    ).toHaveClass('lines')
    expect(
      screen.getByRole('rowheader', { name: '仕上がりに大満足' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: '仕上がりに大満足' }),
    ).toHaveAttribute(
      'href',
      `/salons/${salon.id}/reviews/${answeredReview.id}`,
    )
    expect(screen.getByText('3 件')).toBeVisible()
  })

  it('should name no member of the staff while they are read', async () => {
    // Act
    await stories.StaffUnread.run()

    // Assert
    expect(rows().map((cells) => cells[4])).toEqual(['指名なし', '', ''])
  })

  it('should ask for the reviews that come next', async () => {
    // Arrange
    await stories.More.run()
    const onMore = vi.mocked(stories.More.args.onMore ?? (() => undefined))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(onMore).toHaveBeenCalledOnce()
    expect(screen.getByText('23 件（2 件を表示しています）')).toBeVisible()
  })
})
