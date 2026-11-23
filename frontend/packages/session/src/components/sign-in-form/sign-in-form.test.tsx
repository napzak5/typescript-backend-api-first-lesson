import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { act, type ReactNode, useLayoutEffect } from 'react'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as signInFormStories from './sign-in-form.stories'

const stories = composeStories(signInFormStories)

type WhereTheFocusIs = (focused: Element | null) => void

type InCommitProps = {
  seen: WhereTheFocusIs
  children: ReactNode
}

/**
 * Hands over where the focus is in the commit that shows what it holds: the
 * layout effect of a component runs after those of what it holds, and before
 * the browser paints.
 */
const InCommit = ({ seen, children }: InCommitProps) => {
  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  return children
}

/** Stands in for `onSubmit`, and keeps what the form handed over as pairs of name and value. */
const receiver = () => {
  const received: [string, FormDataEntryValue][][] = []

  return {
    received,
    onSubmit: vi.fn((values: FormData) => {
      received.push([...values])
    }),
  }
}

describe('SignInForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should ask for the email address, the password and whether to stay signed in', async () => {
    // Act
    await stories.Credentials.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'メールアドレス' }),
    ).toBeRequired()
    expect(screen.getByLabelText('パスワード')).toBeRequired()
    expect(
      screen.getByRole('checkbox', { name: '30 日間サインインしたままにする' }),
    ).not.toBeChecked()
  })

  it('should let a password manager fill in the values', async () => {
    // Act
    await stories.Credentials.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'メールアドレス' }),
    ).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('パスワード')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
  })

  it('should hand over the values under the names of the controls when it is sent', async () => {
    // Arrange
    const { received, onSubmit } = receiver()
    await stories.Credentials.run({
      args: { ...stories.Credentials.args, onSubmit },
    })
    await userEvent.type(
      screen.getByRole('textbox', { name: 'メールアドレス' }),
      'customer1@example.com',
    )
    await userEvent.type(screen.getByLabelText('パスワード'), 'a-password')
    await userEvent.click(
      screen.getByRole('checkbox', { name: '30 日間サインインしたままにする' }),
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'サインイン' }))

    // Assert
    expect(received).toEqual([
      [
        ['email', 'customer1@example.com'],
        ['password', 'a-password'],
        ['rememberMe', 'on'],
      ],
    ])
  })

  it('should be sent with the Enter key', async () => {
    // Arrange
    await stories.Credentials.run()

    // Act
    await userEvent.type(
      screen.getByLabelText('パスワード'),
      'a-password{Enter}',
    )

    // Assert
    expect(stories.Credentials.args.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('should be sent with empty values too, for its owner to say what is missing', async () => {
    // Arrange
    await stories.Credentials.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'サインイン' }))

    // Assert
    expect(stories.Credentials.args.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('should say what is wrong with a value at its control, and move the focus to the first', async () => {
    // Act
    await stories.WithFieldErrors.run()

    // Assert
    const email = screen.getByRole('textbox', { name: 'メールアドレス' })
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription(
      'メールアドレスを入力してください。',
    )
    expect(screen.getByLabelText('パスワード')).toHaveAccessibleDescription(
      'パスワードを入力してください。',
    )
    expect(email).toHaveFocus()
  })

  it.each([
    {
      story: 'WithFieldErrors',
      annotations: signInFormStories.WithFieldErrors,
      control: 'メールアドレス',
    },
    {
      story: 'TwoFactorCode',
      annotations: signInFormStories.TwoFactorCode,
      control: '認証コード',
    },
  ])(
    'should have moved the focus in the commit that shows $story, before it is painted',
    async ({ annotations, control }) => {
      // Arrange
      const seen = vi.fn<WhereTheFocusIs>()
      const Story = composeStory(
        {
          ...annotations,
          decorators: [
            (Form) => (
              <InCommit seen={seen}>
                <Form />
              </InCommit>
            ),
          ],
        },
        signInFormStories.default,
      )

      // Act
      await Story.run()

      // Assert
      expect(seen).toHaveBeenLastCalledWith(
        screen.getByRole('textbox', { name: control }),
      )
    },
  )

  it('should announce a refusal as an alert', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'メールアドレスまたはパスワードが正しくありません。',
    )
  })

  it('should not be sent again by the Enter key while an attempt is on its way', async () => {
    // Arrange
    await stories.Pending.run()

    // Act
    await userEvent.type(
      screen.getByLabelText('パスワード'),
      'a-password{Enter}',
    )

    // Assert
    expect(screen.getByRole('button', { name: 'サインイン' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should not be sent again by a script while an attempt is on its way', async () => {
    // Arrange
    await stories.Pending.run()
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'サインイン',
    })

    // Act: an extension that sends the form itself presses no button
    button.form?.requestSubmit()

    // Assert
    expect(button.form).toBeInstanceOf(HTMLFormElement)
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should ask for the code alone in the second step, with the focus on it', async () => {
    // Act
    await stories.TwoFactorCode.run()

    // Assert
    const code = screen.getByRole('textbox', { name: '認証コード' })
    expect(code).toHaveFocus()
    expect(code).toHaveAttribute('autocomplete', 'one-time-code')
    expect(code).toHaveAccessibleDescription(
      '認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。',
    )
    expect(
      screen.queryByRole('textbox', { name: 'メールアドレス' }),
    ).not.toBeInTheDocument()
  })

  it('should hand over the code when the second step is sent', async () => {
    // Arrange
    const { received, onSubmit } = receiver()
    await stories.TwoFactorCode.run({
      args: { ...stories.TwoFactorCode.args, onSubmit },
    })

    // Act
    await userEvent.type(
      screen.getByRole('textbox', { name: '認証コード' }),
      '123456{Enter}',
    )

    // Assert
    expect(received).toEqual([[['twoFactorCode', '123456']]])
  })

  it('should offer no way back in the first step, although its screen always gives one', async () => {
    // Act
    await stories.Credentials.run({
      args: { ...stories.Credentials.args, onBack: vi.fn() },
    })

    // Assert
    expect(
      screen.queryByRole('button', { name: 'メールアドレスの入力に戻る' }),
    ).not.toBeInTheDocument()
  })

  it('should offer the way back to the first step', async () => {
    // Arrange
    await stories.TwoFactorCode.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'メールアドレスの入力に戻る' }),
    )

    // Assert
    expect(stories.TwoFactorCode.args.onBack).toHaveBeenCalledTimes(1)
    expect(stories.TwoFactorCode.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should say that a code is wrong at the control', async () => {
    // Act
    await stories.WrongTwoFactorCode.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: '認証コード' }),
    ).toHaveAccessibleDescription(
      /コードが正しくありません。新しいコードを入力してください。/,
    )
  })
})

describe('SignInForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its controls and its button in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Credentials.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeVisible()
    expect(screen.getByLabelText('Password')).toBeVisible()
    expect(
      screen.getByRole('checkbox', { name: 'Keep me signed in for 30 days' }),
    ).toHaveAccessibleDescription(
      'Do not choose this on a device that others use too.',
    )
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  it('should ask for the code in English at the second step', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.TwoFactorCode.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Authentication code' }),
    ).toHaveAccessibleDescription(
      'Enter the 6-digit code shown in your authenticator app, or a backup code.',
    )
    expect(
      screen.getByRole('button', { name: 'Back to the email address' }),
    ).toBeVisible()
  })

  it('should say in English that the credentials were refused', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The email address or the password is not correct. After 5 wrong attempts in a row, you cannot sign in for 15 minutes.',
    )
  })

  it('should say the errors anew when the page turns English, and leave the focus where it is', async () => {
    // Arrange
    await stories.WithFieldErrors.run()
    const email = screen.getByRole('textbox', { name: 'メールアドレス' })
    email.blur()

    // Act
    act(() => {
      languageStore.choose('en')
    })

    // Assert
    expect(email).toHaveAccessibleName('Email address')
    expect(email).toHaveAccessibleDescription('Enter an email address.')
    expect(email).not.toHaveFocus()
  })
})
