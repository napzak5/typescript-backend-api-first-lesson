import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PasswordChangeForm } from './password-change-form'

const meta: Meta<typeof PasswordChangeForm> = {
  title: 'Session/Security/PasswordChangeForm',
  component: PasswordChangeForm,
  args: {
    cancelHref: '/account/security',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {}

/** The API did not take the current password */
export const CurrentPasswordWrong: Story = {
  args: {
    errors: {
      currentPassword:
        '現在のパスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。',
    },
  },
}

/** The API did not take the new password */
export const NewPasswordRefused: Story = {
  args: {
    errors: {
      newPassword:
        'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
    },
  },
}

export const Sending: Story = {
  args: { pending: true },
}

/** The change did not reach the API */
export const Unsent: Story = {
  args: {
    message:
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
