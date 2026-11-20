import type { Meta, StoryObj } from '@storybook/react-vite'
import { card, transfer } from '../examples'
import { PaymentMethodRecord } from './payment-method-record'

const meta: Meta<typeof PaymentMethodRecord> = {
  title: 'Admin/PaymentMethods/PaymentMethodRecord',
  component: PaymentMethodRecord,
  args: { method: card(), currency: 'JPY' },
}

export default meta

type Story = StoryObj<typeof meta>

/** A card with a description of two lines, a fee, a company and a smallest amount */
export const Recorded: Story = {}

/** A transfer the salon uses no more, with nothing recorded of its fee or company */
export const NotUsed: Story = { args: { method: transfer() } }
