import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../examples'
import { SalonHours } from './salon-hours'

const meta: Meta<typeof SalonHours> = {
  title: 'Portal/Salons/SalonHours',
  component: SalonHours,
  args: {
    businessHours: salon.businessHours,
    openingHours: salon.openingHours,
    timezone: salon.timezone,
    today: '2026-11-19',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Open six days a week, with two dates that differ */
export const Default: Story = {}

/** The salon registered no hours of a week and no dates */
export const NothingRegistered: Story = {
  args: { businessHours: null, openingHours: [] },
}

/** A break at noon, and hours that hold in December only */
export const BreaksAndPeriod: Story = {
  args: {
    businessHours: [
      {
        dayOfWeek: 'monday',
        operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
        breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
        isClosed: false,
        effectivePeriod: null,
      },
      {
        dayOfWeek: 'sunday',
        operatingSlots: [
          { startTime: '09:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '17:00' },
        ],
        breakSlots: null,
        isClosed: false,
        effectivePeriod: {
          startDate: '2026-11-30T15:00:00.000Z',
          endDate: '2026-12-31T14:59:59.000Z',
        },
      },
    ],
    openingHours: [],
  },
}

/** The day after: a date that has passed is of no use any more */
export const ADateHasPassed: Story = {
  args: { today: '2026-11-24' },
}
