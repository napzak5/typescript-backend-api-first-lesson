import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { pendingOrder } from '../examples'
import * as orderTableStories from './order-table.stories'

const stories = composeStories(orderTableStories)

describe('OrderTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say of each order when it was made at the salon, its supplier and status, what it comes to and when it is to be delivered', async () => {
    // Act
    await stories.Orders.run()

    // Assert
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      '発注番号',
      '発注日',
      '仕入先',
      'ステータス',
      '合計',
      '納品予定日',
    ])
    expect(rowsOf(screen.getByRole('table'))).toEqual([
      [
        'PO-7K3M-Q9TX',
        '2026年11月20日（金）',
        '東京ビューティーサプライ',
        '承認待ち',
        '￥14,682',
        '2026年11月27日（金）',
      ],
      [
        'PO-2H8R-W4VN',
        '2026年11月18日（水）',
        'メディカルサプライ',
        '発注済み',
        '￥14,000',
        '未定',
      ],
      [
        'PO-9C5D-J3KP',
        '2026年11月2日（月）',
        '東京ビューティーサプライ',
        '取り消し',
        '￥15,840',
        '未定',
      ],
    ])
    expect(screen.getByRole('status')).toHaveTextContent('3 件')
  })

  it('should lead from the number of an order to the order, and name the row by it', async () => {
    // Act
    await stories.Orders.run()

    // Assert
    const first = screen.getByRole('rowheader', { name: 'PO-7K3M-Q9TX' })
    expect(
      within(first).getByRole('link', { name: 'PO-7K3M-Q9TX' }),
    ).toHaveAttribute(
      'href',
      `/salons/${salon.id}/purchase-orders/${pendingOrder.id}`,
    )
  })

  it('should offer the orders that come next', async () => {
    // Act
    await stories.More.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      '23 件（2 件を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeEnabled()
  })
})
