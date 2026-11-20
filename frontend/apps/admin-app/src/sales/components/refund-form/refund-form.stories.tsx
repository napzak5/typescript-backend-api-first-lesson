import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aPaidSale, aPayment, paymentMethods, salon } from '../examples'

import { RefundForm } from './refund-form'

const meta: Meta<typeof RefundForm> = {
  title: 'Admin/Sales/RefundForm',
  component: RefundForm,
  args: {
    payment: aPayment(),
    methods: paymentMethods,
    timezone: salon.timezone,
    currency: salon.currency,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A payment in cash, given back whole at first */
export const Cash: Story = {}

/** A payment by card, which names the card */
export const ByCard: Story = {
  args: { payment: aPaidSale().payments[1] ?? aPayment() },
}

/** What the form found wrong, or the API refused */
export const WithErrors: Story = {
  args: {
    errors: {
      refundAmount:
        '返金する金額は、支払いの金額（￥3,000）以下にしてください。',
      refundReason: '返金の理由を入力してください。',
    },
  },
}
