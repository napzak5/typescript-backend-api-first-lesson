import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { BookingRow } from '../../day-bookings'
import { aBooking, customers, moment, salon } from '../examples'

import { DayBookingTable } from './day-booking-table'

export const ROWS: BookingRow[] = [
  {
    booking: aBooking({ status: 'confirmed' }),
    customer: customers[0] ?? null,
    staffName: '田中 美咲',
    serviceNames: ['カット'],
  },
  {
    booking: aBooking({
      id: 'f4c27a0d-9b1f-4d02-9e1a-df0b6c9debf8',
      bookingNumber: 'BK-9P2R-7XWN',
      startTime: moment(90),
      endTime: moment(210),
      status: 'pending',
    }),
    customer: null,
    staffName: null,
    serviceNames: ['カラー', null],
  },
]

const meta: Meta<typeof DayBookingTable> = {
  title: 'Admin/Bookings/DayBookingTable',
  component: DayBookingTable,
  args: {
    caption: '2026年11月20日（金）の予約',
    rows: ROWS,
    total: 2,
    timezone: salon.timezone,
    more: 'none',
    onMore: fn(),
    bookingHref: ({ booking }) => `/salons/${salon.id}/bookings/${booking.id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A booking whose names are known, and one whose customer, member and service are gone */
export const Day: Story = {}

/** More bookings can be asked for */
export const WithMore: Story = {
  args: { total: 64, more: 'available' },
}
