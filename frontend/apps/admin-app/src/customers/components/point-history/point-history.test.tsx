import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as pointHistoryStories from './point-history.stories'

const stories = composeStories(pointHistoryStories)

/** The rows of the table, as text: the header of each, and its cells */
const rowsOf = (table: HTMLElement): string[][] =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).getAllByRole('rowheader'),
        ...within(row).getAllByRole('cell'),
      ].map((cell) => cell.textContent ?? ''),
    )

describe('PointHistory', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show each transaction: when, what kind, how the balance moved and what it was after, the expiry, the record and why', async () => {
    // Act
    await stories.Transactions.run()

    // Assert
    expect(
      rowsOf(screen.getByRole('table', { name: 'ポイントの履歴' })),
    ).toEqual([
      [
        '2026年11月20日（金） 09:00',
        '失効',
        '−100',
        '2,700 ポイント',
        '',
        '',
        '',
      ],
      [
        '2026年11月19日（木） 15:00',
        '統合による移行',
        '+800',
        '2,800 ポイント',
        '2027年3月31日（水）',
        '統合したお客様',
        '',
      ],
      [
        '2026年11月18日（水） 10:00',
        '調整',
        '−200',
        '2,000 ポイント',
        '',
        '',
        '付与の誤りを打ち消す',
      ],
      [
        '2026年11月15日（日） 14:30',
        '利用',
        '−300',
        '2,200 ポイント',
        '',
        'ほかのサロンの売上',
        '',
      ],
      [
        '2026年11月10日（火） 12:00',
        '付与',
        '+500',
        '2,500 ポイント',
        '2026年12月10日（木）',
        '売上 SL-2KQM-9F4H',
        'カットのお会計',
      ],
      [
        '2026年11月1日（日） 09:00',
        '調整',
        '+2,000',
        '2,000 ポイント',
        '',
        '',
        'ポイント台帳の開始残高',
      ],
    ])
    expect(screen.getByText('6 件')).toBeVisible()
    expect(
      screen.getByRole('link', { name: '売上 SL-2KQM-9F4H' }),
    ).toBeVisible()
  })

  it('should ask for the transactions that come next', async () => {
    // Arrange
    await stories.More.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(screen.getByText('41 件（2 件を表示しています）')).toBeVisible()
    expect(stories.More.args.onMore).toHaveBeenCalledTimes(1)
  })

  it('should say that the points of the customer never moved', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByText('ポイントの履歴はありません')).toBeVisible()
  })
})
