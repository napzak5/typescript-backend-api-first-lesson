import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as twoFactorStopDialogStories from './two-factor-stop-dialog.stories'

const stories = composeStories(twoFactorStopDialogStories)

const dialog = () =>
  screen.getByRole('dialog', { name: '2 要素認証を無効にしますか？' })
const password = () => within(dialog()).getByLabelText('パスワード')
const code = () =>
  within(dialog()).getByLabelText('認証アプリのコードかバックアップコード')

describe('TwoFactorStopDialog', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what changes, and ask for the password and a code, with the button that changes nothing first', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(dialog()).toHaveAccessibleDescription(
      '無効にすると、サインインのときに確かめるのは、パスワードだけになります。アカウントの持ち主であることを、パスワードと、認証アプリのコードかバックアップコードで確かめます。',
    )
    expect(password()).toHaveAttribute('autocomplete', 'current-password')
    expect(password()).toBeRequired()
    expect(code()).toHaveAttribute('autocomplete', 'one-time-code')
    expect(code()).toBeRequired()
    expect(
      within(dialog())
        .getAllByRole('button', { name: /^(戻る|無効にする)$/ })
        .map((button) => button.textContent),
    ).toEqual(['戻る', '無効にする'])
  })

  it('should hand over the password and the code as they were typed, under the names of the request', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Asking.run({
      args: {
        ...stories.Asking.args,
        onStop: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.type(password(), ' kirei na kami ')
    await userEvent.type(code(), '012 345')
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '無効にする' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['password', ' kirei na kami '],
        ['code', '012 345'],
      ],
    ])
  })

  it('should send nothing again while the request is on its way', async () => {
    // Arrange
    await stories.Sending.run()
    await userEvent.type(password(), 'kirei na kami')
    await userEvent.type(code(), '012345')

    // Act: the button, and the form as Enter in a control sends it
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '無効にする' }),
    )
    fireEvent.submit(code())

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '無効にする' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(stories.Sending.args.onStop).not.toHaveBeenCalled()
  })

  it('should say at each control what it needs', async () => {
    // Act
    await stories.BothMissing.run()

    // Assert
    expect(password()).toBeInvalid()
    expect(password()).toHaveAccessibleDescription(
      'パスワードを入力してください。',
    )
    expect(code()).toBeInvalid()
    expect(code()).toHaveAccessibleDescription(
      expect.stringContaining(
        '認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。',
      ),
    )
  })

  it('should go back without a request', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalled()
    expect(stories.Asking.args.onStop).not.toHaveBeenCalled()
  })

  it('should say that the request did not reach the API', async () => {
    // Act
    await stories.Unsent.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })
})
