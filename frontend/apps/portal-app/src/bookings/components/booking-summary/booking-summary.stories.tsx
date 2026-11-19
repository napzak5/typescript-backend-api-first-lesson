import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../salons/components/examples'
import { booking } from '../examples'
import { BookingSummary } from './booking-summary'

const meta: Meta<typeof BookingSummary> = {
  title: 'Portal/Bookings/BookingSummary',
  component: BookingSummary,
  args: {
    booking,
    salon,
    salonHref: `/salons/${salon.id}`,
    serviceName: 'レディースカット',
    staffName: '田中 ひろし',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A booking that was just made: the salon has not confirmed it */
export const Pending: Story = {}

export const Confirmed: Story = {
  args: { booking: { ...booking, status: 'confirmed' } },
}

export const Completed: Story = {
  args: {
    booking: {
      ...booking,
      status: 'completed',
      completedAt: '2026-11-24T02:35:00.000Z',
    },
  },
}

export const Cancelled: Story = {
  args: {
    booking: {
      ...booking,
      status: 'cancelled',
      cancelledAt: '2026-11-20T00:00:00.000Z',
    },
  },
}

export const NoShow: Story = {
  args: { booking: { ...booking, status: 'no_show' } },
}

/** The price of the service is without tax: the tax is added, and named */
export const WithTaxAdded: Story = {
  args: {
    booking: {
      ...booking,
      taxAmount: 550,
      totalAmount: 6050,
    },
  },
}

export const WithoutRequest: Story = {
  args: { booking: { ...booking, customerRequest: null } },
}

/** A request of several lines, and with a word that no line holds */
export const WithLongRequest: Story = {
  args: {
    booking: {
      ...booking,
      customerRequest:
        '前回と同じ長さでお願いします。\n\nカラーの相談もしたいです。参考にしたい写真があります: https://example.com/hairstyles/2026/autumn/natural-brown-with-soft-highlights-and-long-layers',
    },
  },
}

/** A visit long ago: the salon no longer shows the service, nor the member of the staff */
export const NoLongerShown: Story = {
  args: {
    booking: {
      ...booking,
      status: 'completed',
      completedAt: '2026-11-24T02:35:00.000Z',
    },
    serviceName: null,
    staffName: null,
  },
}
