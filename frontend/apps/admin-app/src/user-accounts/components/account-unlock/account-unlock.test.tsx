import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as accountUnlockStories from './account-unlock.stories'

const stories = composeStories(accountUnlockStories)

const part = (name = 'ロックの解除') => screen.getByRole('region', { name })

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

describe('AccountUnlock on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what the lifting does, and lift the lock, in English', async () => {
    // Arrange
    languageStore.choose('en')
    const onUnlock = vi.fn()
    await stories.Offered.run({ args: { ...stories.Offered.args, onUnlock } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lift the lock' }))

    // Assert
    expect(part('Lifting the lock')).toHaveTextContent(
      'Once the lock is lifted, the user can sign in at once with their current password. The count of wrong passwords goes back to 0. The password and the devices signed in stay as they are.',
    )
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it('should say in English what went wrong with the last attempt', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Failed.run()

    // Assert
    expect(
      within(part('Lifting the lock')).getByRole('alert'),
    ).toHaveTextContent(
      'Could not lift the lock. Check your connection and try again.',
    )
  })
})
