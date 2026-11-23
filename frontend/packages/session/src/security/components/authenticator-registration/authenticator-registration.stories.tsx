import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { twoFactorSetup } from '../examples'
import { AuthenticatorRegistration } from './authenticator-registration'

const meta: Meta<typeof AuthenticatorRegistration> = {
  title: 'Session/Security/AuthenticatorRegistration',
  component: AuthenticatorRegistration,
  args: {
    qrCodeUrl: twoFactorSetup.qrCodeUrl,
    secret: twoFactorSetup.secret,
    cancelHref: '/account/security',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Issued: Story = {}

/** The code was not of six digits, or the API did not take it */
export const CodeWrong: Story = {
  args: {
    errors: {
      code: securityMessages.twoFactorFlow.appCodeWrong,
    },
  },
}

export const Sending: Story = {
  args: { pending: true },
}

/** The code did not reach the API */
export const Unsent: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}
