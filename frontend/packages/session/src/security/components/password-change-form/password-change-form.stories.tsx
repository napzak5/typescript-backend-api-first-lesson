import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
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
      currentPassword: securityMessages.password.currentWrong,
    },
  },
}

/** The API did not take the new password */
export const NewPasswordRefused: Story = {
  args: {
    errors: {
      newPassword: securityMessages.passwordRule.guessable,
    },
  },
}

export const Sending: Story = {
  args: { pending: true },
}

/** The change did not reach the API */
export const Unsent: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}
