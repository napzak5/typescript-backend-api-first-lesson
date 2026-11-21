import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as reviewSummaryStories from './review-summary.stories'

const stories = composeStories(reviewSummaryStories)

/** Each rating with how many reviews give it, in the order they are shown */
const counts = (): string[] =>
  within(screen.getByRole('list', { name: '評価ごとの件数' }))
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
