import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as buttonLinkStories from './button-link.stories'

const stories = composeStories(buttonLinkStories)

describe('ButtonLink', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a link, not a button, that leads where it says', async () => {
    // Act
    await stories.Primary.run()

    // Assert
    expect(screen.getByRole('link', { name: '新しい予約' })).toHaveAttribute(
      'href',
      '/bookings/new',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('should be reached with the Tab key', async () => {
    // Arrange
    await stories.Primary.run()

    // Act
    await userEvent.tab()

    // Assert
    expect(screen.getByRole('link', { name: '新しい予約' })).toHaveFocus()
  })

  it.each([
    { story: stories.Secondary, classes: ['button', 'secondary'] },
    { story: stories.Primary, classes: ['button', 'primary'] },
    { story: stories.Quiet, classes: ['button', 'quiet'] },
    { story: stories.Small, classes: ['button', 'secondary', 'small'] },
  ])('should look like the button of $classes', async ({ story, classes }) => {
    // Act
    await story.run()

    // Assert
    expect(screen.getByRole('link')).toHaveClass(...classes)
  })

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Primary.run({
      args: { ...stories.Primary.args, className: 'in-toolbar' },
    })

    // Assert
    expect(screen.getByRole('link')).toHaveClass('button', 'in-toolbar')
  })
})
