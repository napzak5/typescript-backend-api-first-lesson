import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  aPaidSale,
  aPayment,
  aSale,
  moment,
  paymentMethods,
  salon,
} from '../examples'

import { Receipt } from './receipt'

const meta: Meta<typeof Receipt> = {
  title: 'Admin/Sales/Receipt',
  component: Receipt,
  args: {
    receipt: {
      receiptNumber: 'SL-2KQM-9F4H',
      sale: aPaidSale(),
      issuedAt: moment(70),
    },
    salon,
    methods: paymentMethods,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A cut paid in cash and by card */
export const Paid: Story = {}

/** Paid, part of it given back, at a salon whose address has a building */
export const Refunded: Story = {
  args: {
    receipt: {
      receiptNumber: 'SL-2KQM-9F4H',
      sale: aSale({
        paymentStatus: 'partial_refund',
        payments: [
          aPayment({
            amount: 5500,
            status: 'partial_refund',
            refundAmount: 1000,
          }),
        ],
      }),
      issuedAt: moment(150),
    },
    salon: { ...salon, building: '表参道ビル 2F' },
  },
}
