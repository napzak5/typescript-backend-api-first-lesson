import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import * as customerTableStories from './customer-table.stories'

const stories = composeStories(customerTableStories)

const table = (): HTMLElement => screen.getByRole('table', { name: '顧客台帳' })

describe('CustomerTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the customers with their kana, phone numbers, ranks, states, visits and last visits', async () => {
    // Act
    await stories.Ledger.run()

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
        '山田 花子',
        'ヤマダ ハナコ',
        '090-1234-5678',
        'ゴールド',
        'VIP',
        '14 回',
        '2026年11月18日（水）',
      ],
      [
        '鈴木 一郎',
        'スズキ イチロウ',
        '090-1234-5678',
        'レギュラー',
        '通常',
        '0 回',
        '来店なし',
      ],
      [
        '佐藤 健',
        '',
        '080-2345-6789',
        'レギュラー',
        '利用停止',
        '0 回',
        '来店なし',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('3 人')
  })

  it('should lead from the name to the customer', async () => {
    // Act
    await stories.Ledger.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      customerTableStories.ROWS.map(
        ({ id }) => `/salons/${salon.id}/customers/${id}`,
      ),
    )
  })

  it('should say how many customers there are and offer the rest', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '128 人（3 人を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})
