import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as reviewSummaryStories from './review-summary.stories'

const stories = composeStories(reviewSummaryStories)

const distribution = (): (string | null)[] =>
  within(screen.getByRole('list', { name: '評価ごとの件数' }))
    .getAllByRole('listitem')
    .map((rating) => rating.textContent)

describe('ReviewSummary', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the mean of the ratings and how many they are', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getByRole('img', { name: '5 段階中 4.4（128 件）' }),
    ).toBeVisible()
  })

  it('should say how many customers gave each rating, the best first', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(distribution()).toEqual([
      '評価 576 件',
      '評価 436 件',
      '評価 310 件',
      '評価 24 件',
      '評価 12 件',
    ])
  })

  it('should draw the share of a rating as wide as its part of all the ratings', async () => {
    // Act
    await stories.SomeRatingsNotGiven.run()

    // Assert: 1 of 2, and 0 of 2
    const widths = within(screen.getByRole('list', { name: '評価ごとの件数' }))
      .getAllByRole('listitem')
      .map((rating) => rating.querySelector('rect.part')?.getAttribute('width'))
    expect(widths).toEqual(['50', '50', '0', '0', '0'])
  })

  it('should count a rating the API left out as given by nobody', async () => {
    // Act
    await stories.SomeRatingsNotGiven.run()

    // Assert
    expect(distribution()).toEqual([
      '評価 51 件',
      '評価 41 件',
      '評価 30 件',
      '評価 20 件',
      '評価 10 件',
    ])
  })

  it('should say that there is no rating yet, and draw no shares of nothing', async () => {
    // Act
    await stories.NoReviews.run()

    // Assert
    expect(screen.getByText('評価なし')).toBeVisible()
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('ReviewSummary on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should count the reviews of every rating in English, one as one', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Default.run()

    // Assert
    expect(
      within(screen.getByRole('list', { name: 'Reviews by rating' }))
        .getAllByRole('listitem')
        .map((rating) => rating.textContent),
    ).toEqual([
      '5 stars76 reviews',
      '4 stars36 reviews',
      '3 stars10 reviews',
      '2 stars4 reviews',
      '1 star2 reviews',
    ])
  })
})
