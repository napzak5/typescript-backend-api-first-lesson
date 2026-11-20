import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, customers } from '../../../bookings/components/examples'
import { CustomerChoices } from './customer-choices'

const meta: Meta<typeof CustomerChoices> = {
  title: 'Admin/Customers/CustomerChoices',
  component: CustomerChoices,
  args: {
    customers: [
      ...customers,
      aCustomer({
        id: 'f4c27a8d-9b1e-4d3f-8a6c-2e5b7d9f1a03',
        firstName: '花子',
        lastName: '山田',
        firstNameKana: null,
        lastNameKana: null,
        email: 'hanako.yamada@example.com',
        phoneNumber: '080-2222-3333',
      }),
    ],
    total: 3,
    more: 'none',
    onMore: fn(),
    choose: { type: 'link', hrefOf: ({ id }) => `?customerId=${id}` },
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The customers a keyword found: two of one name, one of them without kana */
export const Customers: Story = {}

/** Each customer is chosen by a button, in a form that stays open */
export const ByButton: Story = {
  args: { choose: { type: 'button', onChoose: fn(), excluded: undefined } },
}

/** The customer the form is about is found too, and cannot be chosen */
export const WithTheCustomerThemselves: Story = {
  args: {
    choose: {
      type: 'button',
      onChoose: fn(),
      excluded: 'f4c27a8d-9b1e-4d3f-8a6c-2e5b7d9f1a03',
    },
  },
}

/** More customers can be asked for */
export const WithMore: Story = {
  args: { total: 42, more: 'available' },
}
