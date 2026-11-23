import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as reportStories from './value-report.stories'

const stories = composeStories(reportStories)

describe('ValueReport', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the total, and list the categories the most valuable first', async () => {
    // Act
    await stories.Value.run()

    // Assert
    expect(
      screen.getByText(
        '在庫評価額の合計は ￥23,600（2 品目）です。在庫数に商品の仕入価格を掛けた額で、仕入価格のない商品は 0 円として数えます。',
      ),
    ).toBeVisible()
    expect(rowsOf('カテゴリーごとの在庫評価額')).toEqual([
      ['ヘアケア', '1 品目', '￥12,000'],
      ['ヘアカラー', '1 品目', '￥11,600'],
    ])
  })

  it('should name the products of no category', async () => {
    // Act
    await stories.WithoutACategory.run()

    // Assert
    expect(rowsOf('カテゴリーごとの在庫評価額')[2]).toEqual([
      'カテゴリーなし',
      '1 品目',
      '￥0',
    ])
  })

  it('should say that there is no stock, without a table', async () => {
    // Act
    await stories.NoStock.run()

    // Assert
    expect(screen.getByText('在庫のある商品はありません')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('ValueReport on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the total and the categories in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithoutACategory.run()

    // Assert
    expect(
      screen.getByText(
        'The inventory is worth ¥23,600 in all (3 items). It is the stock times the purchase price of each product; a product without a purchase price counts for nothing.',
      ),
    ).toBeVisible()
    expect(rowsOf('Inventory value by category')).toEqual([
      ['ヘアケア', '1 item', '¥12,000'],
      ['ヘアカラー', '1 item', '¥11,600'],
      ['No category', '1 item', '¥0'],
    ])
  })

  it('should say in English that there is no stock', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NoStock.run()

    // Assert
    expect(screen.getByText('No products are in stock')).toBeVisible()
  })
})
