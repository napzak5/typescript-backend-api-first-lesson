import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as loadingIndicatorStories from './loading-indicator.stories'

const stories = composeStories(loadingIndicatorStories)

describe('LoadingIndicator', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what is being waited for, as a status', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      /^空き時間を確認しています$/,
    )
  })

  it('should keep the turning mark from assistive technology', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('status').firstElementChild).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByRole('status').firstElementChild).toHaveClass('spinner')
  })
})
