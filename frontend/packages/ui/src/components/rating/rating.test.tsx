import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as ratingStories from './rating.stories'

const stories = composeStories(ratingStories)

describe('Rating', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it.each([
    { story: stories.One, name: '5 段階中 4.0', text: '4.0' },
    {
      story: stories.MeanOfMany,
      name: '5 段階中 4.3（128 件）',
      text: '4.3（128 件）',
    },
    {
      story: stories.Highest,
      name: '5 段階中 5.0（3 件）',
      text: '5.0（3 件）',
    },
    {
      story: stories.Lowest,
      name: '5 段階中 1.0（1 件）',
      text: '1.0（1 件）',
    },
  ])(
    'should be read out as $name, and show the number with one decimal',
    async ({ story, name, text }) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('img', { name })).toHaveTextContent(text)
    },
  )

  it.each([
    { story: stories.One, name: '5 段階中 4.0', width: '80' },
    {
      story: stories.MeanOfMany,
      name: '5 段階中 4.3（128 件）',
      width: '86.6',
    },
    { story: stories.Highest, name: '5 段階中 5.0（3 件）', width: '100' },
    { story: stories.Lowest, name: '5 段階中 1.0（1 件）', width: '20' },
  ])(
    'should fill the five stars, each 20 wide, as far as the rating goes: $width for $name',
    async ({ story, name, width }) => {
      // Act
      await story.run()

      // Assert: the filled stars are cut off where the rating ends
      const drawing = screen.getByRole('img', { name })
      expect(drawing.querySelector('svg')).toHaveAttribute(
        'viewBox',
        '0 0 100 20',
      )
      expect(drawing.querySelector('clipPath rect')).toHaveAttribute(
        'width',
        width,
      )
    },
  )

  it('should say in words that nothing was rated yet, and draw no stars', async () => {
    // Act
    await stories.NotRated.run()

    // Assert
    expect(screen.getByText('評価なし')).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it.each([
    { story: stories.One, name: '4.0 out of 5', text: '4.0' },
    {
      story: stories.MeanOfMany,
      name: '4.3 out of 5 (128 ratings)',
      text: '4.3(128 ratings)',
    },
    {
      story: stories.Lowest,
      name: '1.0 out of 5 (1 rating)',
      text: '1.0(1 rating)',
    },
  ])(
    'should be named and counted in English on a page in English: $name',
    async ({ story, name, text }) => {
      // Arrange
      languageStore.choose('en')

      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('img', { name }).textContent).toBe(text)
    },
  )

  it('should say in English that nothing was rated yet', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NotRated.run()

    // Assert
    expect(screen.getByText('Not rated')).toBeVisible()
    expect(screen.queryByText('評価なし')).toBeNull()
  })
})
