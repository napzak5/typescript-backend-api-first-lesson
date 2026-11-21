import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as staffSalesStories from './staff-sales.stories'

const stories = composeStories(staffSalesStories)

const TABLE = 'スタッフ別の売上'

/** The rows of the table, cell by cell */
const rowsOf = (): (string | null)[][] =>
  within(screen.getByRole('table', { name: TABLE }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent),
    )

/** The bar under the sales of a member of the staff */
const barOf = (name: string, sales: string): Element | null | undefined =>
  within(screen.getByRole('row', { name: new RegExp(name) })).getByText(sales)
    .nextElementSibling?.firstElementChild

describe('StaffSales', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should rank every member of the staff in the order of the API, a member a row named by them', async () => {
    // Act
    await stories.Ranked.run()

    // Assert
    expect(rowsOf()).toEqual([
      ['1 位', 'Mika Suzuki', '￥23,100', '3 件', '￥7,700'],
      ['2 位', 'Hiroshi Tanaka', '￥12,100', '2 件', '￥6,050'],
      ['3 位', 'Yuki Sato', '￥9,900', '2 件', '￥4,950'],
      ['4 位', 'Kenji Watanabe', '￥5,500', '1 件', '￥5,500'],
      ['5 位', 'Aoi Ito', '￥3,300', '0 件', '￥0'],
    ])
    expect(
      screen.getByRole('rowheader', { name: 'Hiroshi Tanaka' }),
    ).toBeInTheDocument()
  })

  it('should draw the sales of each under them, as long as their share of the most', async () => {
    // Act
    await stories.Ranked.run()

    // Assert
    expect(barOf('Mika Suzuki', '￥23,100')).toHaveStyle({ inlineSize: '100%' })
    expect(barOf('Aoi Ito', '￥3,300')).toHaveStyle({
      inlineSize: `${(3300 * 100) / 23_100}%`,
    })
  })

  it('should say under the table how the sales of a member are counted', async () => {
    // Act
    await stories.Alone.run()

    // Assert
    expect(
      screen.getByText(/商品の売上も入ります。施術の数と施術の平均単価は/),
    ).toBeInTheDocument()
    expect(rowsOf()).toHaveLength(1)
  })
})
