import {
  fieldMessages,
  sessionMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
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
      email: fieldMessages.emailMissing,
      password: sessionMessages.signInFlow.passwordMissing,
    },
  },
}

/** The API refused the attempt: it does not say which value is wrong. */
export const Refused: Story = {
  args: {
    message: sessionMessages.signInFlow.wrongCredentials,
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
      twoFactorCode: sessionMessages.signInFlow.wrongCode,
    },
  },
}
