import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ReferrerField } from './referrer-field'

const meta: Meta<typeof ReferrerField> = {
  title: 'Admin/Customers/ReferrerField',
  component: ReferrerField,
  args: {
    referrer: { type: 'none' },
    onChoose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Nobody referred the customer */
export const Nobody: Story = {}

/** A customer of the ledger referred them */
export const Chosen: Story = {
  args: {
    referrer: {
      type: 'customer',
      id: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
      name: '鈴木 一郎',
    },
  },
}

/** The customer who referred them was removed from the ledger since */
export const Gone: Story = {
  args: {
    referrer: { type: 'gone', id: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5' },
  },
}

/** The API did not take the customer that was chosen */
export const WithError: Story = {
  args: {
    ...Chosen.args,
    error: adminCustomerMessages.referrer.absent,
  },
}
