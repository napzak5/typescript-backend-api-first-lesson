import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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

  it('should keep the address out of sight, and still read, in a narrow header', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.SignedIn.run()

    // Assert
    expect(screen.getByText('hanako@example.com')).toHaveClass('hidden')
  })

  it('should show the whole address in the menu of a narrow screen, above buttons as high as its links', async () => {
    // Act
    await stories.InTheMenu.run()

    // Assert
    const menu = within(screen.getByRole('dialog', { name: 'メインメニュー' }))
    expect(
      menu.getByText(
        'hanako.yamada.reservations@beauty-salon-group.example.com',
      ),
    ).toHaveClass('userInMenu')
    for (const control of [
      menu.getByRole('link', { name: 'アカウントの安全' }),
      menu.getByRole('button', { name: 'サインアウト' }),
    ]) {
      expect(control).not.toHaveClass('small')
    }
  })

  it('should keep the address short and the buttons small in the header', async () => {
    // Act
    await stories.WithTheSecurityOfTheAccount.run()

    // Assert
    expect(screen.getByRole('link', { name: 'アカウントの安全' })).toHaveClass(
      'small',
    )
    expect(screen.getByRole('button', { name: 'サインアウト' })).toHaveClass(
      'small',
    )
  })

  it('should lead to the security of the account where the application has a screen for it, and nowhere else', async () => {
    // Act
    await stories.WithTheSecurityOfTheAccount.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'アカウントの安全' }),
    ).toHaveAttribute('href', '/account/security')
    expect(
      screen
        .getAllByRole('link')
        .concat(screen.getAllByRole('button'))
        .map((control) => control.textContent),
    ).toEqual(['アカウントの安全', 'サインアウト'])
  })

  it('should lead nowhere but out where the application gives no screen of the security of the account', async () => {
    // Act
    await stories.SignedIn.run()

    // Assert
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
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

describe('AccountMenu on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should lead to the security of the account and sign out in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithTheSecurityOfTheAccount.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'Account security' }),
    ).toHaveAttribute('href', '/account/security')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  it('should offer to sign in in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.SignedOutWithSignInScreen.run()

    // Assert
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    )
  })
})
