import { Button } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { anInvitation, anInvitedMember, NOW } from '../examples'
import { InvitationRecord } from './invitation-record'

const meta: Meta<typeof InvitationRecord> = {
  title: 'Admin/StaffAccounts/InvitationRecord',
  component: InvitationRecord,
  args: {
    invitation: anInvitation(),
    member: anInvitedMember(),
    now: NOW,
    timezone: salon.timezone,
    actions: <Button variant='danger'>招待を取り消す</Button>,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An invitation mailed yesterday, which the member can still take */
export const Waiting: Story = {}

/** An invitation whose week ran out */
export const Expired: Story = {
  args: {
    invitation: anInvitation({
      role: 'manager',
      createdAt: '2026-11-10T01:00:00Z',
      expiresAt: '2026-11-17T01:00:00Z',
    }),
  },
}

/** An invitation mailed to an address the ledger was corrected from */
export const Elsewhere: Story = {
  args: { invitation: anInvitation({ email: 'misaki.typo@example.com' }) },
}

/** An invitation of a member who was made inactive since */
export const OfAnInactiveMember: Story = {
  args: { member: anInvitedMember({ isActive: false }) },
}
