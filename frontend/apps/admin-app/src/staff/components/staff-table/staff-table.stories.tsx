import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { aNewMember, aStaffMember, theOwner } from '../examples'
import { StaffTable } from './staff-table'

const meta: Meta<typeof StaffTable> = {
  title: 'Admin/Staff/StaffTable',
  component: StaffTable,
  args: {
    rows: [theOwner(), aStaffMember(), aNewMember()],
    total: 3,
    more: 'none',
    onMore: fn(),
    memberHref: (id) => `/salons/${salon.id}/staff/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The owner, a stylist who takes bookings, and a member registered before joining, who is not active yet */
export const Found: Story = {}

/** More members can be asked for */
export const WithMore: Story = {
  args: { total: 24, more: 'available' },
}
