import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as signOutEverywhereStories from './sign-out-everywhere.stories'

const stories = composeStories(signOutEverywhereStories)

const QUESTION = 'すべての端末でサインアウトしますか？'

const openButton = () =>
  screen.getByRole('button', { name: 'すべての端末でサインアウトする' })
const dialog = () => screen.getByRole('dialog', { name: QUESTION })
const confirmButton = () =>
  within(dialog()).getByRole('button', { name: 'サインアウトする' })

describe('SignOutEverywhere', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should ask nothing before its button is pressed', async () => {
    // Act
    await stories.Offered.run()

    // Assert
    expect(openButton()).toBeEnabled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should ask for the dialog, and sign out nothing, when its button is pressed', async () => {
    // Arrange
    await stories.Offered.run()

    // Act
    await userEvent.click(openButton())

    // Assert
    expect(stories.Offered.args.onOpen).toHaveBeenCalledTimes(1)
    expect(stories.Offered.args.onConfirm).not.toHaveBeenCalled()
  })

  it('should say that this device is signed out too, with the button that changes nothing first', async () => {
    // Act
    await stories.Confirming.run()

    // Assert
    expect(dialog()).toHaveAccessibleDescription(
      'この端末も含めて、このアカウントでサインインしている端末の、すべてのサインインを終わらせます。続けて使うには、もう一度サインインしてください。',
    )
    expect(
      within(dialog())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['戻る', 'サインアウトする'])
  })

  it('should sign out when it is confirmed', async () => {
    // Arrange
    await stories.Confirming.run()

    // Act
    await userEvent.click(confirmButton())

    // Assert
    expect(stories.Confirming.args.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should close and sign out nothing when the person goes back', async () => {
    // Arrange
    await stories.OpenedByButton.run()
    await userEvent.click(openButton())

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(stories.OpenedByButton.args.onClose).toHaveBeenCalled()
    expect(stories.OpenedByButton.args.onConfirm).not.toHaveBeenCalled()
  })

  it('should say in the dialog what went wrong', async () => {
    // Act
    await stories.Unsent.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should show that the sign-out is on its way, and not ask for it again', async () => {
    // Arrange
    await stories.Sending.run()

    // Act
    await userEvent.click(confirmButton())

    // Assert
    expect(confirmButton()).toHaveAttribute('aria-busy', 'true')
    expect(stories.Sending.args.onConfirm).not.toHaveBeenCalled()
  })
})

describe('SignOutEverywhere on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer, ask and say in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unsent.run()

    // Assert
    expect(
      screen.getByRole('button', { name: 'Sign out on every device' }),
    ).toBeVisible()
    const question = screen.getByRole('dialog', {
      name: 'Sign out on every device?',
    })
    expect(question).toHaveAccessibleDescription(
      'This ends every sign-in of this account, on this device too. To go on, sign in again.',
    )
    expect(
      within(question)
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(['Back', 'Sign out'])
    expect(within(question).getByRole('alert')).toHaveTextContent(
      'It could not be sent. Check your connection and try again.',
    )
  })
})
