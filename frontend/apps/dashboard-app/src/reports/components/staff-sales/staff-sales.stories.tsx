import type { Meta, StoryObj } from '@storybook/react-vite'
import { byStaff } from '../examples'
import { StaffSales } from './staff-sales'

const meta: Meta<typeof StaffSales> = {
  title: 'Dashboard/Reports/StaffSales',
  component: StaffSales,
  args: { staff: byStaff, currency: 'JPY' },
}

export default meta

type Story = StoryObj<typeof meta>

/** Five members of the staff, the last of whom sold products alone */
export const Ranked: Story = {}

/** One member of the staff */
export const Alone: Story = { args: { staff: byStaff.slice(0, 1) } }
