import type { Meta, StoryObj } from '@storybook/react-vite'
import { moment } from '../../../bookings/components/examples'
import { aPaidSale, aPayment, paymentMethods, salon } from '../examples'

import { PaymentTable } from './payment-table'

const meta: Meta<typeof PaymentTable> = {
  title: 'Admin/Sales/PaymentTable',
  component: PaymentTable,
  args: {
    payments: aPaidSale().payments,
    methods: paymentMethods,
    timezone: salon.timezone,
    currency: salon.currency,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Cash, then the rest by card */
export const Paid: Story = {}

/** Nothing received yet */
export const Empty: Story = {
  args: { payments: [] },
}

/** A payment by a method the salon removed, with only the brand of the card, given back in part */
export const Refunded: Story = {
  args: {
    payments: [
      aPayment({
        paymentMethodId: 'removed',
        cardBrand: 'JCB',
        status: 'partial_refund',
        refundAmount: 1000,
        refundedAt: moment(90),
        refundReason: 'お釣りの渡し忘れ',
      }),
    ],
  },
}

/** Seen by an account that gives payments back: those that were received link to the screen that does */
export const GivenBackByOwner: Story = {
  args: {
    payments: [
      aPayment({
        status: 'refunded',
        refundAmount: 3000,
        refundedAt: moment(90),
        refundReason: null,
      }),
      ...aPaidSale().payments.slice(1),
    ],
    refundHrefOf: ({ id, status }) =>
      status === 'completed' ? `/payments/${id}/refund` : undefined,
  },
}
