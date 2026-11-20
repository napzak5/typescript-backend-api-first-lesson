import { Button, ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { aNewMember, aStaffMember } from '../examples'
import { StaffRecord } from './staff-record'

const meta: Meta<typeof StaffRecord> = {
  title: 'Admin/Staff/StaffRecord',
  component: StaffRecord,
  args: {
    member: aStaffMember(),
    timezone: salon.timezone,
    currency: salon.currency,
    actions: (
      <>
        <ButtonLink href='/' variant='secondary'>
          スタッフ情報を直す
        </ButtonLink>
        <Button variant='danger'>削除</Button>
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A stylist with everything the ledger keeps of a member, and an account to sign in with */
export const Full: Story = {}

/** A member registered before joining: what may be left out was, and no account is linked yet */
export const Sparse: Story = {
  args: { member: aNewMember() },
}
