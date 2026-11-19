import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  aBooking,
  customers,
  moment,
  salon,
  services,
  staff,
} from '../examples'
import { BookingRecord } from './booking-record'

const [cut, color] = services

const meta: Meta<typeof BookingRecord> = {
  title: 'Admin/Bookings/BookingRecord',
  component: BookingRecord,
  args: {
    booking: aBooking({
      customerRequest: '前髪は、眉が隠れるくらいの長さにしたいです。',
    }),
    customer: customers[0] ?? null,
    staff,
    services,
    timezone: salon.timezone,
    currency: salon.currency,
    lineHrefOf: (lineId) =>
      `/salons/${salon.id}/bookings/d2a05e8b/services/${lineId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A booking that waits to be confirmed */
export const Pending: Story = {}

/** A booking that was carried out: taken on the phone with a deposit, two services (one without a member), a discount, the times it actually took */
export const Completed: Story = {
  args: {
    booking: aBooking({
      status: 'completed',
      endTime: moment(150),
      subtotal: 14300,
      discountAmount: 1000,
      taxAmount: 0,
      totalAmount: 13300,
      internalNotes: '次回はトリートメントを提案する。',
      source: 'phone',
      depositAmount: 2000,
      actualStartTime: moment(5),
      actualEndTime: moment(160),
      completedAt: moment(165),
      services: [
        {
          id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          serviceId: color?.id ?? '',
          staffId: null,
          startTime: moment(60),
          endTime: moment(150),
          duration: 90,
          price: 8800,
          discountAmount: 1000,
          finalPrice: 7800,
          taxIncluded: true,
          isCompleted: true,
          completedAt: moment(165),
          notes: null,
          sortOrder: 1,
        },
        {
          id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
          serviceId: cut?.id ?? '',
          staffId: staff[0]?.id ?? null,
          startTime: moment(0),
          endTime: moment(60),
          duration: 60,
          price: 5500,
          discountAmount: 0,
          finalPrice: 5500,
          taxIncluded: true,
          isCompleted: true,
          completedAt: moment(165),
          notes: null,
          sortOrder: 0,
        },
      ],
    }),
  },
}

/** A booking that was cancelled, of a customer who was removed since */
export const Cancelled: Story = {
  args: {
    booking: aBooking({
      status: 'cancelled',
      cancelledAt: '2026-11-19T06:30:00.000Z',
      cancellationReason: '体調不良のため',
      cancellationFee: 0,
      staffId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9e09',
    }),
    customer: null,
  },
}
