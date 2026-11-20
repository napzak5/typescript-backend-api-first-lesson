import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { card } from '../examples'
import * as tableStories from './payment-method-table.stories'

const stories = composeStories(tableStories)

/** The rows of the table, each as the texts of its cells. */
const rows = (): string[][] =>
  within(screen.getByRole('table', { name: '支払い方法' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent ?? ''),
    )

describe('PaymentMethodTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list every method in its order, with what it takes, its fee, where and whether it is used', async () => {
    // Act
    await stories.Listed.run()

    // Assert
    expect(rows()).toEqual([
      ['現金', '現金', '下限も上限もなし', '手数料なし', '店頭', '使っている'],
      [
        'クレジットカード（端末 1）',
        'クレジットカード',
        '￥1,000から',
        '3.24%',
        '店頭、オンライン',
        '使っている',
      ],
      [
        '交通系 IC',
        '電子マネー',
        '￥20,000まで',
        '3.25%',
        '店頭',
        '使っている',
      ],
      [
        '銀行振込',
        '銀行振込',
        '￥10,000から￥500,000まで',
        '記録なし',
        'オンライン',
        '使っていない',
      ],
    ])
  })

  it('should lead from the name to the method', async () => {
    // Act
    await stories.Listed.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'クレジットカード（端末 1）' }),
    ).toHaveAttribute(
      'href',
      `/salons/${salon.id}/settings/payment-methods/${card().id}`,
    )
  })

  it('should say that there is no method', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByText('支払い方法はありません')).toBeVisible()
  })
})
