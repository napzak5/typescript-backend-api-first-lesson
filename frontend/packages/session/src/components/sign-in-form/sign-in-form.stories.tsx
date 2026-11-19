import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SignInForm } from './sign-in-form'

const meta: Meta<typeof SignInForm> = {
  title: 'Session/SignInForm',
  component: SignInForm,
  args: { step: 'credentials', onSubmit: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

export const Credentials: Story = {}

/** Nothing was entered: every field says what it needs. */
export const WithFieldErrors: Story = {
  args: {
    errors: {
      email: 'メールアドレスを入力してください。',
      password: 'パスワードを入力してください。',
    },
  },
}

/** The API refused the attempt: it does not say which value is wrong. */
export const Refused: Story = {
  args: {
    message:
      'メールアドレスまたはパスワードが正しくありません。続けて 5 回誤ると、15 分間サインインできなくなります。',
  },
}

export const Pending: Story = {
  args: { pending: true },
}

/** The second step of an account with two-factor authentication. */
export const TwoFactorCode: Story = {
  args: { step: 'twoFactorCode', onBack: fn() },
}

export const WrongTwoFactorCode: Story = {
  args: {
    step: 'twoFactorCode',
    onBack: fn(),
    errors: {
      twoFactorCode:
        'コードが正しくありません。新しいコードを入力してください。',
    },
  },
}
