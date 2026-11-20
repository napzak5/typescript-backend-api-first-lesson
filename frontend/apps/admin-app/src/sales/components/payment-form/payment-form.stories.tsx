import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { methodsInUse } from '../../payments'
import { paymentMethods } from '../examples'

import { PaymentForm } from './payment-form'

const meta: Meta<typeof PaymentForm> = {
  title: 'Admin/Sales/PaymentForm',
  component: PaymentForm,
  args: {
    methods: methodsInUse(paymentMethods),
    owed: 5500,
    currency: 'JPY',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The whole of what is left to pay, by a method that is still to be chosen */
export const Owed: Story = {}

/** Less is left to pay after a payment in part */
export const Rest: Story = {
  args: { owed: 2500 },
}

/** What the form found wrong, or the API refused */
export const WithErrors: Story = {
  args: {
    errors: {
      paymentMethodId: '支払い方法を選んでください。',
      amount: '金額は、未払い残額（￥5,500）以下にしてください。',
    },
  },
}
