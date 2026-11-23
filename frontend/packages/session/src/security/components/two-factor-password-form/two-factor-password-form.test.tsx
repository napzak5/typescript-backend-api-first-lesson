import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { act } from 'react'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as twoFactorPasswordFormStories from './two-factor-password-form.stories'

const stories = composeStories(twoFactorPasswordFormStories)

const password = () => screen.getByLabelText('パスワード')

describe('TwoFactorPasswordForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Empty, () =>
    screen.getByLabelText('パスワード'),
  )

  it('should ask for the password of the account, as a password manager fills it in, and say why', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(password()).toHaveAttribute('autocomplete', 'current-password')
    expect(password()).toBeRequired()
    expect(password()).toHaveAccessibleDescription(
      'このアカウントのパスワードです。設定するのが、アカウントの持ち主であることを確かめます。',
    )
  })

  it('should hand over the password as it was typed, under the name of the request', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Empty.run({
      args: {
        ...stories.Empty.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.type(password(), ' kirei na kami ')
    await userEvent.click(screen.getByRole('button', { name: '設定を始める' }))

    // Assert
    expect(received).toEqual([[['password', ' kirei na kami ']]])
  })

  it('should lead back to the screen of the security of the account', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByRole('link', { name: 'やめる' })).toHaveAttribute(
      'href',
      '/account/security',
    )
  })

  it('should say at the password that the API did not take it', async () => {
    // Act
    await stories.PasswordWrong.run()

    // Assert
    expect(password()).toBeInvalid()
    expect(password()).toHaveAccessibleDescription(
      expect.stringContaining(
        'パスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。',
      ),
    )
  })

  it('should say that the password did not reach the API', async () => {
    // Act
    await stories.Unsent.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })
})

describe('TwoFactorPasswordForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should ask for the password in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'The password of this account. It confirms that it is the owner of the account who sets this up.',
    )
    expect(
      screen.getByRole('button', { name: 'Begin the set-up' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Cancel' })).toBeVisible()
  })

  it('should say the errors anew when the page turns English, and leave the focus where it is', async () => {
    // Arrange
    await stories.PasswordWrong.run()
    screen.getByLabelText('パスワード').blur()

    // Act
    act(() => {
      languageStore.choose('en')
    })

    // Assert
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      expect.stringContaining(
        'The password is not correct. After 5 wrong attempts in a row, you cannot sign in either for 15 minutes.',
      ),
    )
    expect(screen.getByLabelText('Password')).not.toHaveFocus()
  })
})
