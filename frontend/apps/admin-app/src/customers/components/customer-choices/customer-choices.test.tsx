import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as customerChoicesStories from './customer-choices.stories'

const stories = composeStories(customerChoicesStories)

describe('CustomerChoices', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the customers by name, kana, phone number and address, each name leading on', async () => {
    // Act
    await stories.Customers.run()

    // Assert
    const rows = within(screen.getByRole('table', { name: '見つかったお客様' }))
      .getAllByRole('row')
      .slice(1)
    expect(
      rows.map((row) =>
        [
          ...within(row).getAllByRole('rowheader'),
          ...within(row).getAllByRole('cell'),
        ].map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['山田 花子', 'ヤマダ ハナコ', '090-1234-5678', 'hanako@example.com'],
      ['鈴木 一郎', 'スズキ イチロウ', '090-1234-5678', 'ichiro@example.com'],
      ['山田 花子', '', '080-2222-3333', 'hanako.yamada@example.com'],
    ])
    expect(
      screen.getAllByRole('link', { name: '山田 花子' }).at(-1),
    ).toHaveAttribute(
      'href',
      '?customerId=f4c27a8d-9b1e-4d3f-8a6c-2e5b7d9f1a03',
    )
    expect(screen.getByRole('status').textContent).toBe('3 人')
  })

  it('should say how many of the customers are shown', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '42 人（3 人を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})
