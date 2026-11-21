import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as emptyStateStories from './empty-state.stories'

const stories = composeStories(emptyStateStories)

describe('EmptyState', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say in words what is not there, in a frame where the content of the page would be', async () => {
    // Act
    await stories.TitleOnly.run()
    const title = screen.getByText('予約はまだありません')

    // Assert
    expect(title).toHaveClass('title')
    expect(title.parentElement).toHaveClass('emptyState', 'page')
  })

  it('should say it quietly, without a frame, inside a part of a page', async () => {
    // Act
    await stories.InAPart.run()
    const title = screen.getByText('施術写真はありません。')

    // Assert
    expect(title.parentElement).toHaveClass('emptyState', 'part')
    expect(title.parentElement).not.toHaveClass('page')
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
    await stories.WithActions.run()
    const action = screen.getByRole('link', { name: 'サロンを探す' })

    // Assert
    expect(action).toHaveAttribute('href', '/salons')
    expect(action.parentElement?.previousElementSibling).toHaveTextContent(
      '予約すると、ここに表示されます。',
    )
    expect(action.parentElement).toHaveClass('flow')
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
