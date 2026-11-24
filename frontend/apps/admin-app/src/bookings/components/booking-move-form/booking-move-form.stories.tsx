import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aBooking, moment, salon, services, staff } from '../examples'
import { BookingMoveForm } from './booking-move-form'

const { errors } = adminBookingMessages.entry

const [cut, color] = services
const [misaki] = staff

/** A booking of two lines: a cut with the member of the booking, then a colour with nobody */
const booking = aBooking({
  endTime: moment(120),
  duration: 120,
  services: [
    {
      id: 'e3b16f9c-8a0e-4cf1-8fd0-ce9a5b8cade7',
      serviceId: cut?.id ?? '',
      staffId: misaki?.id ?? null,
      startTime: moment(0),
      endTime: moment(60),
      duration: 60,
      price: 5500,
      discountAmount: 0,
      finalPrice: 5500,
      taxIncluded: true,
      isCompleted: false,
      completedAt: null,
      notes: null,
      sortOrder: 0,
    },
    {
      id: 'f4c27a0d-9b1f-4d02-9a1e-df0b6c9dbef8',
      serviceId: color?.id ?? '',
      staffId: null,
      startTime: moment(60),
      endTime: moment(120),
      duration: 60,
      price: 8800,
      discountAmount: 0,
      finalPrice: 8800,
      taxIncluded: true,
      isCompleted: false,
      completedAt: null,
      notes: null,
      sortOrder: 1,
    },
  ],
})

const meta: Meta<typeof BookingMoveForm> = {
  title: 'Admin/Bookings/BookingMoveForm',
  component: BookingMoveForm,
  args: {
    staff,
    services,
    booking,
    timezone: salon.timezone,
    moved: booking.services,
    onValuesChange: fn(),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Opened with what the booking has: its lines where they are */
export const Opened: Story = {}

/** The time was cleared: there is no move to show */
export const Unmoved: Story = {
  args: { moved: undefined },
}

/** What was typed is no move: at the controls */
export const WithErrors: Story = {
  args: {
    moved: undefined,
    errors: {
      staffId: errors.staff,
      startTime: errors.startTime,
    },
  },
}

/** The API refused the move: the member of the first line is taken where it would be */
export const Refused: Story = {
  args: {
    message: adminBookingMessages.moves.move.taken,
    checks: [
      {
        type: 'taken',
        overlapping: [
          aBooking({
            id: 'c1f94d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
            bookingNumber: 'BK-9QWE-3RTY',
            startTime: moment(-30),
            endTime: moment(30),
          }),
        ],
      },
      { type: 'unassigned' },
    ],
  },
}

/** The move is on its way */
export const Sending: Story = {
  args: { pending: true },
}
