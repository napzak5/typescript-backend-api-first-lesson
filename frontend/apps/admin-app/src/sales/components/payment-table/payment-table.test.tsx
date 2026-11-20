import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as paymentTableStories from './payment-table.stories'

const stories = composeStories(paymentTableStories)

const rowsOf = (): (string | null)[][] =>
  within(screen.getByRole('table', { name: '支払い' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

describe('PaymentTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the payments with their times on the clock of the salon, their methods and their cards', async () => {
    // Act
    await stories.Paid.run()

    // Assert
    expect(rowsOf()).toEqual([
      [
        'PT-7KQM-4F2H',
        '2026年11月20日（金） 11:05',
        '現金',
        '￥3,000',
        'なし',
        '受け取り',
      ],
      [
        'PT-9F4H-2KQM',
        '2026年11月20日（金） 11:06',
        'クレジットカード',
        '￥2,500',
        'VISA 下 4 桁 4242',
        '受け取り',
      ],
    ])
  })

  it('should say that nothing was received yet', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(rowsOf()).toEqual([['まだ支払いはありません']])
  })

  it('should name a method the salon removed, and what was recorded of the card', async () => {
    // Act
    await stories.Refunded.run()

    // Assert
    expect(rowsOf()).toEqual([
      [
        'PT-7KQM-4F2H',
        '2026年11月20日（金） 11:05',
        '一覧にない支払い方法',
        '￥3,000',
        'JCB',
        '一部返金',
      ],
    ])
  })
})
