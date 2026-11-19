import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as emptyStateStories from './empty-state.stories'

const stories = composeStories(emptyStateStories)

describe('EmptyState', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say in words what is not there', async () => {
    // Act
    await stories.TitleOnly.run()

    // Assert
    expect(screen.getByText('予約はまだありません')).toHaveClass('title')
  })

  it('should say what to do about it', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(screen.getByText('予約すると、ここに表示されます。')).toHaveClass(
      'description',
    )
  })

  it('should offer the first step after its text', async () => {
    // Act
    await stories.WithAction.run()
    const action = screen.getByRole('link', { name: 'サロンを探す' })

    // Assert
    expect(action).toHaveAttribute('href', '/salons')
    expect(action.previousElementSibling).toHaveTextContent(
      '予約すると、ここに表示されます。',
    )
  })

  it('should hold nothing but its title when it is given nothing else', async () => {
    // Act
    await stories.TitleOnly.run()

    // Assert
    expect(
      screen.getByText('予約はまだありません').parentElement?.children,
    ).toHaveLength(1)
  })
})
