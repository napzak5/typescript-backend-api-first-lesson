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
        'なし',
      ],
      [
        'PT-9F4H-2KQM',
        '2026年11月20日（金） 11:06',
        'クレジットカード',
        '￥2,500',
        'VISA 下 4 桁 4242',
        '受け取り',
        'なし',
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
        '￥1,000、2026年11月20日（金） 11:30',
      ],
    ])
    expect(screen.getByRole('term')).toHaveTextContent(
      'PT-7KQM-4F2H の返金の理由',
    )
    expect(screen.getByRole('definition')).toHaveTextContent('お釣りの渡し忘れ')
  })

  it('should link a payment that can be given back to the screen that does, named by its number', async () => {
    // Act
    await stories.GivenBackByOwner.run()

    // Assert
    expect(rowsOf().map((row) => row.slice(-2))).toEqual([
      ['返金済み', '￥3,000、2026年11月20日（金） 11:30'],
      ['受け取り', '返金する'],
    ])
    expect(screen.queryByRole('term')).toBeNull()
    expect(
      screen.getByRole('link', { name: 'PT-9F4H-2KQM を返金する' }),
    ).toHaveAttribute(
      'href',
      '/payments/7a8b9c0d-1e2f-4a3b-8c5d-6e7f80910213/refund',
    )
  })
})
