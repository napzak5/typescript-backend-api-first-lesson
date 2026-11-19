import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as environmentBannerStories from './environment-banner.stories'

const stories = composeStories(environmentBannerStories)

describe('EnvironmentBanner', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each([
    { story: stories.Development, name: 'development' },
    { story: stories.Staging, name: 'staging' },
    { story: stories.Test, name: 'test' },
    { story: stories.Localhost, name: 'localhost' },
  ])('should name the $name environment', async ({ story, name }) => {
    // Act
    await story.run()

    // Assert
    expect(screen.getByText(name)).toBeVisible()
  })

  it('should show nothing in production', async () => {
    // Act
    await stories.Production.run()

    // Assert
    expect(screen.queryByText('production')).not.toBeInTheDocument()
  })
})
