import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as trendChartStories from './trend-chart.stories'

const stories = composeStories(trendChartStories)

/** The column of a part, found by what shows on a pointer over it */
const columnOf = (tip: string): Element | null =>
  screen.getByText(tip).previousElementSibling

describe('TrendChart', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should draw the sales of every part as a column, as high as its share of a round top of the scale', async () => {
    // Act
    await stories.Months.run()

    // Assert: the most is ￥74,800, so the scale ends at ￥100,000
    expect(columnOf('2025年12月 ￥48,000')).toHaveStyle({ blockSize: '48%' })
    expect(columnOf('2026年1月 ￥0')).toHaveStyle({ blockSize: '0%' })
    expect(columnOf('2026年10月 ￥74,800')).toHaveStyle({
      blockSize: '74.8%',
    })
    expect(screen.getByText('￥10万')).toBeInTheDocument()
    expect(screen.getByText('￥5万')).toBeInTheDocument()
    expect(screen.getByText('￥0')).toBeInTheDocument()
  })

  it('should name the first and the last part alone on the axis', async () => {
    // Act
    await stories.Months.run()

    // Assert
    expect(screen.getByText('2025年12月')).toBeInTheDocument()
    expect(screen.getByText('2026年11月')).toBeInTheDocument()
    expect(screen.queryByText('2026年6月')).not.toBeInTheDocument()
  })

  it('should write the amounts of an axis below 10,000 in full, and name a week by its Monday', async () => {
    // Act
    await stories.Weeks.run()

    // Assert: the most is ￥7,700, so the scale ends at ￥10,000
    expect(screen.getByText('￥1万')).toBeInTheDocument()
    expect(screen.getByText('￥5,000')).toBeInTheDocument()
    expect(columnOf('2026年11月2日（月）からの週 ￥7,700')).toHaveStyle({
      blockSize: '77%',
    })
    expect(screen.getByText('2026/10/26')).toBeInTheDocument()
    expect(screen.getByText('2026/11/16')).toBeInTheDocument()
  })

  it('should keep what shows on a pointer within the chart: from the start of a part in the first half, from its end in the second', async () => {
    // Act
    await stories.Weeks.run()

    // Assert
    expect(
      screen.getByText('2026年10月26日（月）からの週 ￥5,500'),
    ).toHaveClass('fromStart')
    expect(
      screen.getByText('2026年11月16日（月）からの週 ￥2,200'),
    ).toHaveClass('fromEnd')
  })

  it('should leave no gap between the columns of more parts than it has room for', async () => {
    // Act
    await stories.DaysOfAYear.run()

    // Assert
    const first = columnOf('2023年12月1日（金） ￥20,000')
    expect(first?.parentElement?.parentElement).toHaveClass('dense')
    expect(screen.getByText('2023/12/1')).toBeInTheDocument()
    expect(screen.getByText('2024/11/30')).toBeInTheDocument()
  })

  it('should name one part once, and keep the months apart', async () => {
    // Act
    await stories.OneDay.run()

    // Assert
    expect(screen.getAllByText('2026/11/21')).toHaveLength(1)
    expect(
      columnOf('2026年11月21日（土） ￥13,200')?.parentElement?.parentElement,
    ).not.toHaveClass('dense')
  })

  it('should be hidden from assistive technology: the table beside it holds the same sales', async () => {
    // Act
    await stories.Months.run()

    // Assert
    expect(
      screen.getByText('￥10万').closest('[aria-hidden="true"]'),
    ).not.toBeNull()
  })
})
