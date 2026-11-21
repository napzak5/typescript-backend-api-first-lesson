import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as unreadNoticeStories from './unread-notice.stories'

const stories = composeStories(unreadNoticeStories)

const retryButton = () =>
  screen.getByRole('button', { name: 'もう一度読み込む' })

describe('UnreadNotice', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say why nothing was read, at once', async () => {
    // Act
    await stories.Unread.run()

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'メニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should ask again when its button is pressed', async () => {
    // Arrange
    await stories.Unread.run()

    // Act
    await userEvent.click(retryButton())

    // Assert
    expect(stories.Unread.args.onRetry).toHaveBeenCalledTimes(1)
  })

  it('should show that the API is being asked again, and not ask again', async () => {
    // Arrange
    await stories.Pending.run()

    // Act
    await userEvent.click(retryButton())

    // Assert
    expect(retryButton()).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onRetry).not.toHaveBeenCalled()
  })
})
