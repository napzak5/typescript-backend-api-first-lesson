import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as reorderSuggestionsStories from './reorder-suggestions.stories'

const stories = composeStories(reorderSuggestionsStories)

describe('ReorderSuggestions', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show a card for each supplier, in the order of their names, and the products that name none last', async () => {
    // Act
    await stories.BySupplier.run()

    // Assert
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map(({ textContent }) => textContent),
    ).toEqual([
      'カラーテック・ジャパン',
      '東京ビューティーサプライ',
      '仕入先の決まっていない商品',
    ])
  })

  it('should say for each product how many there are, are on order and are to be ordered', async () => {
    // Act
    await stories.BySupplier.run()

    // Assert
    const shampoo = screen.getByRole('region', {
      name: '東京ビューティーサプライ',
    })
    const table = within(shampoo).getByRole('table', {
      name: '東京ビューティーサプライの提案',
    })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(({ textContent }) => textContent),
    ).toEqual([
      '商品コード',
      '商品名',
      '在庫',
      '発注中',
      '発注点',
      '最大在庫数',
      '提案する数量',
      '最後の発注日',
    ])
    expect(rowsOf(table)).toEqual([
      [
        'SHMP001',
        'プロフェッショナル シャンプー 500ml',
        '4.5 本',
        '2.5 本',
        '10 本',
        '50 本',
        '43 本',
        '2026年11月20日（金）',
      ],
    ])
    expect(
      within(table).getByRole('rowheader', {
        name: 'プロフェッショナル シャンプー 500ml',
      }),
    ).toBeVisible()
  })

  it('should say that a product keeps no maximum and was never ordered', async () => {
    // Act
    await stories.BySupplier.run()

    // Assert
    const table = within(
      screen.getByRole('region', { name: '仕入先の決まっていない商品' }),
    ).getByRole('table')
    expect(rowsOf(table)).toEqual([
      [
        'SUP-GLOVE',
        'ニトリル手袋 M',
        '0.5 箱',
        '0 箱',
        '2 箱',
        '設定なし',
        '1.5 箱',
        'なし',
      ],
    ])
  })

  it('should lead from each supplier to a new order that starts with its suggestions', async () => {
    // Act
    await stories.BySupplier.run()

    // Assert
    expect(
      screen
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      [
        'カラーテック・ジャパン への発注を作る',
        `/salons/salon/purchase-orders/new?suggested=${encodeURIComponent('カラーテック・ジャパン')}`,
      ],
      [
        '東京ビューティーサプライ への発注を作る',
        `/salons/salon/purchase-orders/new?suggested=${encodeURIComponent('東京ビューティーサプライ')}`,
      ],
      [
        '仕入先を決めて発注を作る',
        '/salons/salon/purchase-orders/new?suggested=',
      ],
    ])
  })
})
