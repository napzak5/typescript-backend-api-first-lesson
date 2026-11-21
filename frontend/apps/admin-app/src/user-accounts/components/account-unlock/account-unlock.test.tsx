import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as accountUnlockStories from './account-unlock.stories'

const stories = composeStories(accountUnlockStories)

const part = () => screen.getByRole('region', { name: 'ロックの解除' })

describe('AccountUnlock', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the lifting does, and lift the lock when its button is pressed', async () => {
    // Arrange
    const onUnlock = vi.fn()
    await stories.Offered.run({ args: { ...stories.Offered.args, onUnlock } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'ロックを解除する' }),
    )

    // Assert
    expect(part()).toHaveTextContent(
      '解除すると、利用者は、いまのパスワードですぐにログインできます。パスワードの誤りの回数は 0 に戻ります。パスワードと、ログインしている端末は変わりません。',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it('should not lift the lock twice while it is on its way', async () => {
    // Arrange
    const onUnlock = vi.fn()
    await stories.Pending.run({ args: { ...stories.Pending.args, onUnlock } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'ロックを解除する' }),
    )

    // Assert
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('should say what went wrong with the last attempt', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(within(part()).getByRole('alert')).toHaveTextContent(
      'ロックを解除できませんでした。',
    )
  })
})
