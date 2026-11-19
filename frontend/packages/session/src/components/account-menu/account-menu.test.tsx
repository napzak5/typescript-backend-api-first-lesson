import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as accountMenuStories from './account-menu.stories'

const stories = composeStories(accountMenuStories)

describe('AccountMenu', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say who is signed in', async () => {
    // Act
    await stories.SignedIn.run()

    // Assert
    expect(screen.getByText('hanako@example.com')).toHaveClass('user')
  })

  it('should sign out when its button is pressed', async () => {
    // Arrange
    await stories.SignedIn.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'サインアウト' }))

    // Assert
    expect(stories.SignedIn.args.onSignOut).toHaveBeenCalledTimes(1)
  })

  it('should lead somebody who is not signed in to the sign-in screen it is given', async () => {
    // Act
    await stories.SignedOutWithSignInScreen.run()

    // Assert
    expect(screen.getByRole('link', { name: 'サインイン' })).toHaveAttribute(
      'href',
      '/sign-in',
    )
    expect(
      screen.queryByRole('button', { name: 'サインアウト' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['is given no sign-in screen', stories.SignedOut],
    ['does not know yet who is signed in', stories.Loading],
  ])('should show nothing when it %s', async (_, story) => {
    // Act
    await story.run()

    // Assert
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
