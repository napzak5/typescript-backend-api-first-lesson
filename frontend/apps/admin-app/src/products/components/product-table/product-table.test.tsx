import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../examples'
import * as productTableStories from './product-table.stories'

const stories = composeStories(productTableStories)

const table = (): HTMLElement => screen.getByRole('table', { name: '商品台帳' })

describe('ProductTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the products with their codes, categories, brands, prices, uses and states', async () => {
    // Act
    await stories.Ledger.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        'COLOR001',
        'ヘアカラー ナチュラルブラウン',
        'ヘアカラー',
        'ColorTech',
        '￥1,800',
        '施術',
        '取り扱い中',
      ],
      [
        'SHMP001',
        'プロフェッショナル シャンプー 500ml',
        'ヘアケア',
        'Salon Pro',
        '￥3,000',
        '店頭販売、施術',
        '取り扱い中',
      ],
      [
        'SUP-GLOVE',
        'ニトリル手袋 M',
        '記録なし',
        '記録なし',
        '記録なし',
        'どちらでもない',
        '取り扱い中',
      ],
      [
        'WAX001',
        'スタイリングワックス 80g',
        'スタイリング',
        'Style Master',
        '￥1,800',
        '店頭販売',
        '取り扱いをやめた',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('4 件')
  })

  it('should lead from the name to the product', async () => {
    // Act
    await stories.Ledger.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual(
      PRODUCTS_OF_THE_SALON.map(({ id, name }) => [
        name,
        `/salons/${salon.id}/products/${id}`,
      ]),
    )
  })

  it('should ask for the products that come next', async () => {
    // Arrange
    await stories.WithMore.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.WithMore.args.onMore).toHaveBeenCalledOnce()
    expect(screen.getByRole('status').textContent).toBe(
      '64 件（4 件を表示しています）',
    )
  })
})

describe('ProductTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its columns and write its rows, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Ledger.run()

    // Assert
    const ledger = screen.getByRole('table')
    expect(
      within(ledger)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Product code',
      'Product name',
      'Category',
      'Brand',
      'Sale price',
      'Use',
      'Status',
    ])
    expect(rowsOf(ledger).map((row) => row.slice(4))).toEqual([
      ['¥1,800', 'Treatment', 'Active'],
      ['¥3,000', 'In-store sale, Treatment', 'Active'],
      ['Not recorded', 'Neither', 'Active'],
      ['¥1,800', 'In-store sale', 'Discontinued'],
    ])
    expect(screen.getByRole('status').textContent).toBe('4 items')
  })
})
