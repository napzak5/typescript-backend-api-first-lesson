import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as twoFactorPasswordFormStories from './two-factor-password-form.stories'

const stories = composeStories(twoFactorPasswordFormStories)

const password = () => screen.getByLabelText('パスワード')

describe('TwoFactorPasswordForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

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
