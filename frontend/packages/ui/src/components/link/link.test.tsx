import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as linkStories from './link.stories'

const stories = composeStories(linkStories)

describe('Link', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a plain link when the application gave no link of its own', async () => {
    // Act
    await stories.Plain.run()

    // Assert
    expect(screen.getByRole('link', { name: '予約の一覧' })).toHaveAttribute(
      'href',
      '/bookings',
    )
  })

  it('should be drawn by the link the application gave', async () => {
    // Act
    await stories.WithProvider.run()

    // Assert
    expect(screen.getByRole('link', { name: '予約の一覧' })).toHaveAttribute(
      'href',
      '/admin/bookings',
    )
  })

  it('should say that it leads to the current screen', async () => {
    // Act
    await stories.Current.run()

    // Assert
    expect(screen.getByRole('link', { name: '予約の一覧' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('should pass its class on to the link that is drawn', async () => {
    // Act
    await stories.WithProvider.run({
      args: { ...stories.WithProvider.args, className: 'in-toolbar' },
    })

    // Assert
    expect(screen.getByRole('link', { name: '予約の一覧' })).toHaveClass(
      'in-toolbar',
    )
  })
})
