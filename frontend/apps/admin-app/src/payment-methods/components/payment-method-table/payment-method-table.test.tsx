import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { card } from '../examples'
import * as tableStories from './payment-method-table.stories'

const stories = composeStories(tableStories)

describe('PaymentMethodTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list every method in its order, with what it takes, its fee, where and whether it is used', async () => {
    // Act
    await stories.Listed.run()

    // Assert
    expect(rowsOf('支払い方法')).toEqual([
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

describe('PaymentMethodTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its columns and write its rows, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Listed.run()

    // Assert
    const table = screen.getByRole('table', { name: 'Payment methods' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Display name',
      'Type',
      'Amount at a time',
      'Fee rate',
      'Where used',
      'Status',
    ])
    expect(rowsOf(table)).toEqual([
      ['現金', 'Cash', 'No limits', 'No fee', 'In store', 'In use'],
      [
        'クレジットカード（端末 1）',
        'Credit card',
        '¥1,000 or more',
        '3.24%',
        'In store, Online',
        'In use',
      ],
      ['交通系 IC', 'E-money', 'Up to ¥20,000', '3.25%', 'In store', 'In use'],
      [
        '銀行振込',
        'Bank transfer',
        '¥10,000 to ¥500,000',
        'Not recorded',
        'Online',
        'Not in use',
      ],
    ])
  })

  it('should say that there is no method, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByText('No payment methods')).toBeVisible()
  })
})
