import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../examples'
import * as saleTableStories from './sale-table.stories'

const stories = composeStories(saleTableStories)

const table = (): HTMLElement =>
  screen.getByRole('table', { name: '2026年11月20日（金）の売上' })

describe('SaleTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the sales with their times on the clock of the salon, their totals and how far they were paid', async () => {
    // Act
    await stories.Day.run()

    // Assert
    const rows = within(table()).getAllByRole('row').slice(1)
    expect(
      rows.map((row) =>
        [
          ...within(row).getAllByRole('rowheader'),
          ...within(row).getAllByRole('cell'),
        ].map((cell) => cell.textContent),
      ),
    ).toEqual([
      [
        'SL-7XWN-3P2R',
        '2026年11月20日（金） 14:00',
        '￥13,200',
        '一部受け取り',
      ],
      ['SL-2KQM-9F4H', '2026年11月20日（金） 11:02', '￥5,500', '支払い済み'],
      ['SL-4F7H-8KQM', '2026年11月20日（金） 09:00', '￥4,400', '取り消し'],
    ])
    expect(screen.getByRole('status').textContent).toBe('3 件')
  })

  it('should lead from the number to the sale', async () => {
    // Act
    await stories.Day.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      saleTableStories.ROWS.map(({ id }) => `/salons/${salon.id}/sales/${id}`),
    )
  })

  it('should say how many sales there are and offer the rest', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '64 件（3 件を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})
