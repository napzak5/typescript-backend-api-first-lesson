import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as visuallyHiddenStories from './visually-hidden.stories'

const stories = composeStories(visuallyHiddenStories)

describe('VisuallyHidden', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should keep its words in the page, out of sight', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByText('hanako@example.com')).toHaveClass('hidden')
  })
})
