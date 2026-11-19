import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TwoFactorPasswordForm } from './two-factor-password-form'

const meta: Meta<typeof TwoFactorPasswordForm> = {
  title: 'Session/Security/TwoFactorPasswordForm',
  component: TwoFactorPasswordForm,
  args: {
    cancelHref: '/account/security',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {}

/** The API did not take the password */
export const PasswordWrong: Story = {
  args: {
    errors: {
      password:
        'パスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。',
    },
  },
}

export const Sending: Story = {
  args: { pending: true },
}

/** The password did not reach the API */
export const Unsent: Story = {
  args: {
    message:
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
