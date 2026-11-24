import { adminUserAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { aLockedUser, aUser, NOW, TIMEZONE } from '../examples'
import { UserRecord } from './user-record'

const meta: Meta<typeof UserRecord> = {
  title: 'Admin/UserAccounts/UserRecord',
  component: UserRecord,
  args: {
    user: aUser(),
    now: NOW,
    timezone: TIMEZONE,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A customer of the portal who signs in with two factors */
export const InUse: Story = {}

/** Locked after five wrong passwords in a row, for five minutes more */
export const Locked: Story = {
  args: { user: aLockedUser() },
}

/** The lock ran out, and one wrong password locks the account again */
export const LockRanOut: Story = {
  args: { user: aLockedUser({ lockedUntil: '2026-11-20T02:45:00Z' }) },
}

/** A member of the staff who took the invitation and never signed in */
export const NeverSignedIn: Story = {
  args: {
    user: aUser({
      email: 'misaki.tanaka@example.com',
      role: 'staff',
      twoFactorStatus: 'disabled',
      lastPasswordChange: null,
      lastLoginAt: null,
      lastLoginIp: null,
      customerId: null,
      staffId: '4a2e6c8b-1d3f-4e5a-8b7c-9d0e1f2a3b51',
    }),
  },
}

/** A customer who registered and has not confirmed the address yet */
export const Unverified: Story = {
  args: {
    user: aUser({
      status: 'unverified',
      emailVerified: false,
      twoFactorStatus: 'disabled',
      lastLoginAt: null,
      lastLoginIp: null,
    }),
  },
}

/** An administrator, linked to no ledger */
export const Administrator: Story = {
  args: {
    user: aUser({
      email: 'support@example.com',
      role: 'admin',
      customerId: null,
    }),
  },
}

/** The last attempt found that the lock was lifted meanwhile */
export const ChangedMeanwhile: Story = {
  args: {
    meanwhile: adminUserAccountMessages.unlock.meanwhile,
  },
}
