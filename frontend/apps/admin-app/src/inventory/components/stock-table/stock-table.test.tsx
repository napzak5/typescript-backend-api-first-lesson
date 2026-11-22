import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { STOCK_OF_THE_SALON } from '../examples'
import * as stockTableStories from './stock-table.stories'

const stories = composeStories(stockTableStories)

const table = (): HTMLElement => screen.getByRole('table', { name: '在庫' })

describe('StockTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the rows with their products, lots, expiries, places and stock', async () => {
    // Act
    await stories.Stock.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        'COLOR001',
        'ヘアカラー ナチュラルブラウン',
        'LOT-2025-112',
        '2025年12月31日 期限切れ',
        'バックヤード（棚 B-2）',
        '2.5 本',
      ],
      [
        'COLOR001',
        'ヘアカラー ナチュラルブラウン',
        'LOT-2026-041',
        '2027年3月31日',
        'バックヤード（棚 B-2）',
        '12 本',
      ],
      [
        'SHMP001',
        'プロフェッショナル シャンプー 500ml',
        '記録なし',
        '期限なし',
        '店頭の棚',
        '8 本',
      ],
      [
        'SUP-GLOVE',
        'ニトリル手袋 M',
        '記録なし',
        '期限なし',
        '記録なし',
        '0 箱',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('4 行')
  })

  it('should lead from the name of the product to the row', async () => {
    // Act
    await stories.Stock.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      STOCK_OF_THE_SALON.map(({ id }) => `/salons/${salon.id}/inventory/${id}`),
    )
  })

  it('should name a row of a product that is not among those read as removed', async () => {
    // Act
    await stories.OfARemovedProduct.run()

    // Assert
    expect(rowsOf(table())[0]?.slice(0, 2)).toEqual([
      '記録なし',
      '削除した商品',
    ])
    expect(rowsOf(table())[0]?.slice(5)).toEqual(['2.5'])
  })

  it('should ask for the rows that come next', async () => {
    // Arrange
    await stories.WithMore.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.WithMore.args.onMore).toHaveBeenCalledOnce()
    expect(screen.getByRole('status').textContent).toBe(
      '45 行（4 行を表示しています）',
    )
  })
})
