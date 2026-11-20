import { Button } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { aStaffMember } from '../../../staff/components/examples'
import { anAccount } from '../examples'
import { AccountRecord } from './account-record'

const meta: Meta<typeof AccountRecord> = {
  title: 'Admin/StaffAccounts/AccountRecord',
  component: AccountRecord,
  args: {
    account: anAccount(),
    member: aStaffMember(),
    timezone: salon.timezone,
    actions: <Button variant='danger'>紐づけを解除する</Button>,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A stylist who signs in with two factors */
export const InUse: Story = {}

/** An account made from an invitation, never signed in with yet */
export const NeverSignedIn: Story = {
  args: {
    account: anAccount({
      role: 'manager',
      twoFactorStatus: 'disabled',
      lastLoginAt: null,
    }),
  },
}

/** An account locked after wrong passwords, whose address the ledger no longer has */
export const Locked: Story = {
  args: {
    account: anAccount({
      status: 'locked',
      email: 'misaki.old@example.com',
      twoFactorStatus: 'pending',
    }),
  },
}
