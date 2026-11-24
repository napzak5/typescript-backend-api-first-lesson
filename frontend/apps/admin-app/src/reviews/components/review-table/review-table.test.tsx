import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { answeredReview } from '../examples'
import * as reviewTableStories from './review-table.stories'

const stories = composeStories(reviewTableStories)

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
    expect(rowsOf(screen.getByRole('table'))).toEqual([
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
        '記録なし',
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
    expect(rowsOf(screen.getByRole('table')).map((cells) => cells[4])).toEqual([
      '指名なし',
      '',
      '',
    ])
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

describe('ReviewTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say of each review what it is called, when it was written, whom it rates, its response and its reports, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Reviews.run()

    // Assert
    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Review',
      'Posted',
      'Rating',
      'Comment',
      'Staff member',
      'Response',
      'Reports',
    ])
    expect(rowsOf(table)[0]).toEqual([
      'Review rated 3',
      'Fri, November 20, 2026',
      '3.0',
      '予約していたのに 30 分待ちました。',
      'No staff member',
      'No response',
      '1 pending',
    ])
    expect(rowsOf(table)[1]?.slice(3)).toEqual([
      'Not recorded',
      '佐藤 健',
      'No response',
      'None',
    ])
    expect(rowsOf(table)[2]?.[5]).toBe('Responded')
    expect(screen.getByText('3 items')).toBeVisible()
  })
})
