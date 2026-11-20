import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  aPaidSale,
  aPayment,
  aSale,
  customers,
  moment,
  salon,
  staff,
} from '../examples'

import { SaleRecord } from './sale-record'

const meta: Meta<typeof SaleRecord> = {
  title: 'Admin/Sales/SaleRecord',
  component: SaleRecord,
  args: {
    sale: aSale(),
    customer: customers[0] ?? null,
    staff,
    timezone: salon.timezone,
    currency: salon.currency,
    bookingHref: `/salons/${salon.id}/bookings/${aSale().bookingId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A cut, nothing received yet */
export const Unpaid: Story = {}

/** Paid in cash and by card */
export const Paid: Story = {
  args: { sale: aPaidSale() },
}

/** Paid, a part given back, then voided; the customer and the member were removed */
export const Voided: Story = {
  args: {
    sale: aSale({
      paymentStatus: 'partial_refund',
      isVoid: true,
      voidedAt: moment(120),
      voidReason: '金額の入れ間違い',
      staffId: 'removed',
      notes: '次回の来店で使えるクーポンを渡した',
      payments: [
        aPayment({
          amount: 5500,
          status: 'partial_refund',
          refundAmount: 1000,
          refundedAt: moment(90),
          refundReason: '仕上がりの直し',
        }),
      ],
    }),
    customer: null,
  },
}
