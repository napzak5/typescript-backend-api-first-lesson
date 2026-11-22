import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { TREND_PARTS } from '../../sales-trends'
import * as salesTrendStories from './sales-trend.stories'

const stories = composeStories(salesTrendStories)

const TABLE = '区切りごとの売上、会計の件数、客単価'

describe('SalesTrend', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should hold the sales, the number of sales and the average sale of every part in a table, a part a row', async () => {
    // Act
    await stories.Months.run()

    // Assert
    const counted = rowsOf(TABLE)
    expect(counted).toHaveLength(12)
    expect(counted.slice(0, 2)).toEqual([
      ['2025年12月', '￥48,000', '5 件', '￥9,600'],
      ['2026年1月', '￥0', '0 件', '￥0'],
    ])
    expect(counted.at(-1)).toEqual([
      '2026年11月',
      '￥41,800',
      '4 件',
      '￥10,450',
    ])
    expect(
      within(screen.getByRole('table', { name: TABLE }))
        .getAllByRole('rowheader')
        .at(0),
    ).toHaveTextContent('2025年12月')
  })

  it('should name the days by their weekday, and say how the parts are counted', async () => {
    // Act
    await stories.Days.run()

    // Assert
    expect(rowsOf(TABLE)).toEqual([
      ['2026年11月16日（月）', '￥5,500', '1 件', '￥5,500'],
      ['2026年11月17日（火）', '￥0', '0 件', '￥0'],
      ['2026年11月18日（水）', '￥12,100', '2 件', '￥6,050'],
    ])
    expect(
      within(
        screen.getByRole('region', { name: '区切りごとの売上' }),
      ).getByText(new RegExp(TREND_PARTS)),
    ).toBeVisible()
  })
})
