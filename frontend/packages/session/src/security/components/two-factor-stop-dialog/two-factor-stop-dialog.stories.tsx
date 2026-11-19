import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TwoFactorStopDialog } from './two-factor-stop-dialog'

const meta: Meta<typeof TwoFactorStopDialog> = {
  title: 'Session/Security/TwoFactorStopDialog',
  component: TwoFactorStopDialog,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '32rem' } },
  },
  args: {
    open: true,
    onClose: fn(),
    onStop: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Asking: Story = {}

/** Sent with nothing typed: each control says what it needs */
export const BothMissing: Story = {
  args: {
    errors: {
      password: 'パスワードを入力してください。',
      code: '認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。',
    },
  },
}

/** The API did not take the password: it reads the code only after the password */
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

/** The request did not reach the API */
export const Unsent: Story = {
  args: {
    message:
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
