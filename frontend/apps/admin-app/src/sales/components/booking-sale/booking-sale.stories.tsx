import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aPayment, aSale, salon } from '../examples'

import { BookingSale } from './booking-sale'

const meta: Meta<typeof BookingSale> = {
  title: 'Admin/Sales/BookingSale',
  component: BookingSale,
  args: {
    booking: { status: 'completed' },
    sales: { type: 'found', sales: [] },
    currency: salon.currency,
    saleHref: (saleId) => `/salons/${salon.id}/sales/${saleId}`,
    checkoutHref: `/salons/${salon.id}/bookings/${aSale().bookingId}/checkout`,
    onRetry: fn(),
    retrying: false,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A visit that took place, with no sale yet */
export const Unbilled: Story = {}

/** The sale of the visit, paid in part; one before it was voided */
export const Billed: Story = {
  args: {
    sales: {
      type: 'found',
      sales: [
        aSale({
          paymentStatus: 'processing',
          payments: [aPayment()],
        }),
        aSale({ id: 'voided', saleNumber: 'SL-0000-VOID', isVoid: true }),
      ],
    },
  },
}

/** A booking that was confirmed, whose visit is still to come */
export const Upcoming: Story = {
  args: { booking: { status: 'confirmed' } },
}

/** A booking that was cancelled */
export const Cancelled: Story = {
  args: { booking: { status: 'cancelled' } },
}

/** The sales are on their way */
export const Loading: Story = {
  args: { sales: undefined },
}

/** The sales could not be read */
export const Unread: Story = {
  args: { sales: { type: 'failed' } },
}
