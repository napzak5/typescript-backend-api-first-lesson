import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { PASSWORD_RULE } from '../../password-rule'
import * as passwordChangeFormStories from './password-change-form.stories'

const stories = composeStories(passwordChangeFormStories)

const currentPassword = () => screen.getByLabelText('現在のパスワード')
const newPassword = () => screen.getByLabelText('新しいパスワード')
const submitButton = () =>
  screen.getByRole('button', { name: 'パスワードを変更する' })

describe('PasswordChangeForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Empty, () =>
    screen.getByLabelText('現在のパスワード'),
  )

  it('should ask for the current password and for a new one that keeps the rule, as a password manager fills them in', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(currentPassword()).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(currentPassword()).toBeRequired()
    expect(newPassword()).toHaveAttribute('autocomplete', 'new-password')
    expect(newPassword()).toBeRequired()
    expect(newPassword()).toHaveAccessibleDescription(PASSWORD_RULE)
    expect(screen.getAllByLabelText(/パスワード$/)).toHaveLength(2)
  })

  it('should hand over both passwords as they were typed, under the names of the request', async () => {
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
    await userEvent.type(currentPassword(), ' kirei na kami ')
    await userEvent.type(newPassword(), 'aoi sora to shiroi kumo')
    await userEvent.click(submitButton())

    // Assert
    expect(received).toEqual([
      [
        ['currentPassword', ' kirei na kami '],
        ['newPassword', 'aoi sora to shiroi kumo'],
      ],
    ])
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

  it.each([
    [
      'the current password',
      stories.CurrentPasswordWrong,
      currentPassword,
      newPassword,
    ],
    [
      'the new password',
      stories.NewPasswordRefused,
      newPassword,
      currentPassword,
    ],
  ])(
    'should say at %s what is wrong with it, and nothing at the other',
    async (_, story, wrong, right) => {
      // Act
      await story.run()

      // Assert
      expect(wrong()).toHaveAttribute('aria-invalid', 'true')
      expect(right()).not.toHaveAttribute('aria-invalid', 'true')
    },
  )

  it('should say what went wrong with the attempt as a whole', async () => {
    // Act
    await stories.Unsent.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should not send the change again while it is on its way', async () => {
    // Arrange
    await stories.Sending.run()

    // Act
    await userEvent.click(submitButton())

    // Assert
    expect(submitButton()).toHaveAttribute('aria-busy', 'true')
    expect(stories.Sending.args.onSubmit).not.toHaveBeenCalled()
  })
})
