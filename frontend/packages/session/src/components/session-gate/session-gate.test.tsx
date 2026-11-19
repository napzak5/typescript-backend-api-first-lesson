import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as sessionGateStories from './session-gate.stories'

const stories = composeStories(sessionGateStories)

describe('SessionGate', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the content to a signed-in user of one of the roles', async () => {
    // Act
    await stories.Allowed.run()

    // Assert
    expect(screen.getByText('マイページの内容')).toBeVisible()
    expect(screen.queryByText('サインインの画面')).not.toBeInTheDocument()
  })

  it('should say that it is waiting while the session is checked, and show nothing of the content', async () => {
    // Act
    await stories.Loading.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'サインインを確認しています',
    )
    expect(screen.queryByText('マイページの内容')).not.toBeInTheDocument()
  })

  it('should show the sign-in screen in place of the content to somebody who is not signed in', async () => {
    // Act
    await stories.SignedOut.run()

    // Assert
    expect(screen.getByText('サインインの画面')).toBeVisible()
    expect(screen.queryByText('マイページの内容')).not.toBeInTheDocument()
  })

  it('should say that the session could not be checked, and ask again when told to', async () => {
    // Arrange
    const retry = vi.fn()
    await stories.Unavailable.run({
      args: {
        ...stories.Unavailable.args,
        session: { type: 'unavailable', retry },
      },
    })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))

    // Assert
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'サインインを確認できません',
      }),
    ).toBeVisible()
    expect(screen.queryByText('マイページの内容')).not.toBeInTheDocument()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('should tell an account of another role that the application is not for it, and offer to sign out', async () => {
    // Arrange
    await stories.AnotherRole.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'サインアウト' }))

    // Assert
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'このアプリケーションは利用できません',
      }),
    ).toBeVisible()
    expect(
      screen.getByText(/hanako@example\.com のアカウントでは利用できません。/),
    ).toBeVisible()
    expect(screen.queryByText('マイページの内容')).not.toBeInTheDocument()
    expect(stories.AnotherRole.args.onSignOut).toHaveBeenCalledTimes(1)
  })
})
