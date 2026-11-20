import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aBooking, salon } from '../../../bookings/components/examples'
import { aTreatment } from '../examples'
import { BookingTreatment } from './booking-treatment'

const meta: Meta<typeof BookingTreatment> = {
  title: 'Admin/Treatments/BookingTreatment',
  component: BookingTreatment,
  args: {
    booking: { status: 'completed' },
    found: { type: 'found', record: null },
    timezone: salon.timezone,
    treatmentHref: (id) => `/salons/${salon.id}/treatments/${id}`,
    entryHref: `/salons/${salon.id}/bookings/${aBooking().id}/treatment/new`,
    onRetry: fn(),
    retrying: false,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A booking that was done, without a record yet */
export const Unwritten: Story = {}

/** A booking whose record was written */
export const Written: Story = {
  args: { found: { type: 'found', record: aTreatment() } },
}

/** A booking under treatment: its record can be written already */
export const UnderTreatment: Story = {
  args: { booking: { status: 'in_progress' } },
}

/** A booking whose treatment has not begun */
export const Upcoming: Story = {
  args: { booking: { status: 'confirmed' }, found: undefined },
}

/** A booking that was cancelled */
export const Cancelled: Story = {
  args: { booking: { status: 'cancelled' }, found: undefined },
}

/** The record is on its way */
export const Loading: Story = {
  args: { found: undefined },
}

/** The record could not be read */
export const Unread: Story = {
  args: { found: { type: 'failed' } },
}
