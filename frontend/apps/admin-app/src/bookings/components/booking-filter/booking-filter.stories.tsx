import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DAY, staff } from '../examples'
import { BookingFilter } from './booking-filter'

const meta: Meta<typeof BookingFilter> = {
  title: 'Admin/Bookings/BookingFilter',
  component: BookingFilter,
  args: {
    conditions: { date: DAY },
    staff,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The whole day */
export const WholeDay: Story = {}

/** The confirmed bookings of one member of the staff */
export const Narrowed: Story = {
  args: {
    conditions: {
      date: DAY,
      status: 'confirmed',
      staffId: staff[1]?.id ?? '',
    },
    clearHref: `?date=${DAY}`,
  },
}
