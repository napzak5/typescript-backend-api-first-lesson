import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { account } from '../examples'
import { SecuritySummary } from './security-summary'

const meta: Meta<typeof SecuritySummary> = {
  title: 'Session/Security/SecuritySummary',
  component: SecuritySummary,
  args: {
    user: account,
    passwordHref: '/account/security/password',
    twoFactorHref: '/account/security/two-factor',
    onIssueBackupCodes: fn(),
    onStopTwoFactor: fn(),
    timeZone: 'Asia/Tokyo',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A password that was changed, and no second factor */
export const PasswordOnly: Story = {}

/** The password the account was made with */
export const PasswordNeverChanged: Story = {
  args: { user: { ...account, lastPasswordChange: null } },
}

export const TwoFactorPending: Story = {
  args: { user: { ...account, twoFactorStatus: 'pending' } },
}

export const TwoFactorEnabled: Story = {
  args: { user: { ...account, twoFactorStatus: 'enabled' } },
}
