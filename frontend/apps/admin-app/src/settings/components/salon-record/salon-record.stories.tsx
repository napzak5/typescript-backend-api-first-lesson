import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { aDescribedSalon, TODAY } from '../examples'
import { SalonRecord } from './salon-record'

const meta: Meta<typeof SalonRecord> = {
  title: 'Admin/Settings/SalonRecord',
  component: SalonRecord,
  args: { salon: aDescribedSalon(), today: TODAY },
}

export default meta

type Story = StoryObj<typeof meta>

/** A salon with every value recorded: its week, with a break and a day off, and the dates of its calendar from today */
export const Recorded: Story = {}

/** A salon with little recorded: no week of hours and no dates of a calendar */
export const LittleRecorded: Story = { args: { salon } }

/** A salon that has stopped taking bookings online */
export const NotBookedOnline: Story = {
  args: { salon: { ...aDescribedSalon(), isActive: false } },
}
