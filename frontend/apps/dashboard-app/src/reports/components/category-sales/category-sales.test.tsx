import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as categorySalesStories from './category-sales.stories'

const stories = composeStories(categorySalesStories)

const TABLE = '区分別の売上'

/** The bar under the share of a kind of service */
const barOf = (kind: string, share: string): Element | null | undefined =>
  within(screen.getByRole('row', { name: new RegExp(kind) })).getByText(share)
    .nextElementSibling?.firstElementChild

describe('CategorySales', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show every kind of service in the order of the API, with the sales of one service of it', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(rowsOf(TABLE)).toEqual([
      ['カラー', '￥17,600', '2 件', '￥8,800', '50.0%'],
      ['カット', '￥12,100', '2 件', '￥6,050', '34.4%'],
      ['トリートメント', '￥5,500', '1 件', '￥5,500', '15.6%'],
      ['その他', '￥4,400', '2 件', '￥2,200', '11.1%'],
    ])
    expect(
      screen.getByRole('rowheader', { name: 'カット' }),
    ).toBeInTheDocument()
  })

  it('should draw the share of each kind under it, as long as it is of the whole', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(barOf('カラー', '50.0%')).toHaveStyle({ inlineSize: '50%' })
    expect(barOf('トリートメント', '15.6%')).toHaveStyle({
      inlineSize: '15.6%',
    })
  })

  it('should say under the table how the kinds are counted and what one service sells', async () => {
    // Act
    await stories.OneKind.run()

    // Assert
    expect(
      screen.getByText(
        /商品の売上は入りません。1 件あたりは、売上を施術の数で割った額です（1 円未満は切り捨て）。$/,
      ),
    ).toBeInTheDocument()
    expect(barOf('カット', '100.0%')).toHaveStyle({ inlineSize: '100%' })
  })
})

describe('CategorySales on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name every kind of service and say how the kinds are counted, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Counted.run()

    // Assert
    expect(columnsOf('Sales by category')).toEqual([
      'Category',
      'Sales',
      'Services',
      'Per service',
      'Share',
    ])
    expect(rowsOf('Sales by category')).toEqual([
      ['Color', '¥17,600', '2', '¥8,800', '50.0%'],
      ['Cut', '¥12,100', '2', '¥6,050', '34.4%'],
      ['Treatment', '¥5,500', '1', '¥5,500', '15.6%'],
      ['Other', '¥4,400', '2', '¥2,200', '11.1%'],
    ])
    expect(
      screen.getByText(
        /Products are not included\. Per service is the sales divided by the number of services \(rounded down to a whole amount\)\.$/,
      ),
    ).toBeInTheDocument()
  })
})
