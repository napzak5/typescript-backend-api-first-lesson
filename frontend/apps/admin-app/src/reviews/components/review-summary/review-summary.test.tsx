import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as reviewSummaryStories from './review-summary.stories'

const stories = composeStories(reviewSummaryStories)

/** Each rating with how many reviews give it, in the order they are shown */
const counts = (name = '評価ごとの件数'): string[] =>
  within(screen.getByRole('list', { name }))
    .getAllByRole('listitem')
    .map(({ textContent }) => textContent ?? '')

describe('ReviewSummary', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the mean of the ratings with how many reviews there are, and how many give each rating, the highest first', async () => {
    // Act
    await stories.Reviewed.run()

    // Assert
    expect(
      screen.getByRole('img', { name: '5 段階中 4.0（3 件）' }),
    ).toBeVisible()
    expect(counts()).toEqual([
      '評価 51 件',
      '評価 41 件',
      '評価 31 件',
      '評価 20 件',
      '評価 10 件',
    ])
  })

  it('should say that nobody rated the salon yet', async () => {
    // Act
    await stories.NoReviews.run()

    // Assert
    expect(screen.getByText('評価なし')).toBeVisible()
    expect(counts()).toContain('評価 50 件')
  })
})

describe('ReviewSummary on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the mean of the ratings and how many give each rating, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Reviewed.run()

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Summary of the ratings' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: '4.0 out of 5 (3 ratings)' }),
    ).toBeVisible()
    expect(counts('Reviews by rating')).toEqual([
      '5 stars1 review',
      '4 stars1 review',
      '3 stars1 review',
      '2 stars0 reviews',
      '1 star0 reviews',
    ])
  })

  it('should say in English that nobody rated the salon yet', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NoReviews.run()

    // Assert
    expect(screen.getByText('Not rated')).toBeVisible()
  })
})
