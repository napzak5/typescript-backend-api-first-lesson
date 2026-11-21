import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as dailySalesStories from './daily-sales.stories'

const stories = composeStories(dailySalesStories)

/** What the card of a day says, term by term */
const termsOf = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

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
