import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { METHODS_OF_THE_SALON } from '../examples'
import { PaymentMethodTable } from './payment-method-table'

const meta: Meta<typeof PaymentMethodTable> = {
  title: 'Admin/PaymentMethods/PaymentMethodTable',
  component: PaymentMethodTable,
  args: {
    methods: METHODS_OF_THE_SALON,
    currency: 'JPY',
    methodHref: (id) => `/salons/${salon.id}/settings/payment-methods/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The methods of the stories, the transfer the salon uses no more among them */
export const Listed: Story = {}

/** A salon without a payment method */
export const Empty: Story = { args: { methods: [] } }
