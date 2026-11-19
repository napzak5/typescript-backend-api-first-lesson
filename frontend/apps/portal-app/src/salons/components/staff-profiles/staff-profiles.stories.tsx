import type { Meta, StoryObj } from '@storybook/react-vite'
import { staff } from '../examples'
import { StaffProfiles } from './staff-profiles'

const meta: Meta<typeof StaffProfiles> = {
  title: 'Portal/Salons/StaffProfiles',
  component: StaffProfiles,
  args: { staff },
}

export default meta

type Story = StoryObj<typeof meta>

/**
 * Somebody who wrote everything, somebody who wrote little, and somebody
 * who takes no bookings
 */
export const Default: Story = {}

export const OnePerson: Story = {
  args: { staff: staff.slice(0, 1) },
}
