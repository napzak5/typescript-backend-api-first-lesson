import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { termsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { afterEach, describe, expect, it } from 'vitest'
import * as dailySalesStories from './daily-sales.stories'

const stories = composeStories(dailySalesStories)

describe('DailySales', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the sums of the day in the currency of the salon, under the name of the day', async () => {
    // Act
    await stories.Sold.run()

    // Assert
    expect(termsOf('2026年11月21日（土）の売上')).toEqual([
      ['売上', '￥13,200'],
      ['会計の件数', '2 件'],
      ['返金', '￥2,200'],
      ['純売上', '￥11,000'],
    ])
  })

  it('should show the zeros of a day without a sale', async () => {
    // Act
    await stories.NothingSold.run()

    // Assert
    expect(termsOf('2026年11月22日（日）の売上')).toEqual([
      ['売上', '￥0'],
      ['会計の件数', '0 件'],
      ['返金', '￥0'],
      ['純売上', '￥0'],
    ])
  })
})

describe('DailySales on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the sums of the day under the name of the day, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Sold.run()

    // Assert
    expect(termsOf('Sales on Sat, November 21, 2026')).toEqual([
      ['Sales', '¥13,200'],
      ['Checkouts', '2'],
      ['Refunds', '¥2,200'],
      ['Net sales', '¥11,000'],
    ])
  })
})
