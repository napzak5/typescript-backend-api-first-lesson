import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as notRecordedStories from './not-recorded.stories'

const stories = composeStories(notRecordedStories)

describe('NotRecorded', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say in words, quietly, that nothing was recorded', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByText('記録なし')).toHaveClass('notRecorded')
  })
})
