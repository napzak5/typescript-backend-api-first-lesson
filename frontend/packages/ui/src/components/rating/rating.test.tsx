import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as ratingStories from './rating.stories'

const stories = composeStories(ratingStories)

describe('Rating', () => {
  itShouldBeAccessibleInEveryStory(stories)

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

  it('should say in words that nothing was rated yet, and draw no stars', async () => {
    // Act
    await stories.NotRated.run()

    // Assert
    expect(screen.getByText('評価なし')).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.One.run({
      args: { ...stories.One.args, className: 'in-row' },
    })

    // Assert
    expect(screen.getByRole('img', { name: '5 段階中 4.0' })).toHaveClass(
      'rating',
      'in-row',
    )
  })
})
