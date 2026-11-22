import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
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
