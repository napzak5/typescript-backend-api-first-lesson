import type { ModelsBookingServiceResponse } from '@beauty-salon-frontend/api-client'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { aBooking, moment, salon, services, staff } from '../examples'
import { BookingLineRecord } from './booking-line-record'

const [first] = aBooking().services

/** The line of the booking of the examples: a cut with its member, not done yet */
const waiting: ModelsBookingServiceResponse = first ?? {
  id: '',
  serviceId: '',
  staffId: null,
  startTime: moment(0),
  endTime: moment(60),
  duration: 60,
  price: 0,
  discountAmount: 0,
  finalPrice: 0,
  taxIncluded: true,
  isCompleted: false,
  completedAt: null,
  notes: null,
  sortOrder: 0,
}

const meta: Meta<typeof BookingLineRecord> = {
  title: 'Admin/Bookings/BookingLineRecord',
  component: BookingLineRecord,
  args: {
    line: waiting,
    staff,
    services,
    timezone: salon.timezone,
    currency: salon.currency,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A cut with the member of the booking, not done yet, without a note */
export const Waiting: Story = {}

/** A line of a service the menu no longer has, by a member the salon no longer shows */
export const OfWhatIsGone: Story = {
  args: {
    line: {
      ...waiting,
      serviceId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9f09',
      staffId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9e09',
    },
  },
}

/** A colour with a discount, a price without the tax, nobody to do it, done, with a note */
export const Done: Story = {
  args: {
    line: {
      id: 'f4c27a0d-9b1f-4d02-9a1e-df0b6c9dbef8',
      serviceId: services[1]?.id ?? '',
      staffId: null,
      startTime: moment(60),
      endTime: moment(150),
      duration: 90,
      price: 8800,
      discountAmount: 1000,
      finalPrice: 7800,
      taxIncluded: false,
      isCompleted: true,
      completedAt: moment(155),
      notes: '根元だけ',
      sortOrder: 1,
    },
  },
}
