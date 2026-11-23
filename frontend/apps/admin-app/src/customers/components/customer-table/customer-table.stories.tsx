import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  aCustomer,
  customers,
  salon,
} from '../../../bookings/components/examples'
import { CustomerTable } from './customer-table'

export const ROWS = [
  aCustomer({
    membershipTier: 'gold',
    customerStatus: 'vip',
    firstVisitDate: '2026-01-15',
    lastVisitDate: '2026-11-18',
    visitCount: 14,
  }),
  ...customers.slice(1),
  aCustomer({
    id: 'd2a05e8b-7f9d-4be0-9ecf-bd8f4a7b9cd7',
    lastName: '佐藤',
    firstName: '健',
    lastNameKana: null,
    firstNameKana: null,
    email: 'ken@example.com',
    phoneNumber: '080-2345-6789',
    customerStatus: 'blacklisted',
  }),
]

const meta: Meta<typeof CustomerTable> = {
  title: 'Admin/Customers/CustomerTable',
  component: CustomerTable,
  args: {
    caption: adminCustomerMessages.titles.ledger,
    rows: ROWS,
    total: 3,
    more: 'none',
    onMore: fn(),
    customerHref: (customer) => `/salons/${salon.id}/customers/${customer.id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A customer of a high rank, one who has not come yet, and one who may not book */
export const Ledger: Story = {}

/** More customers can be asked for */
export const WithMore: Story = {
  args: { total: 128, more: 'available' },
}

/** The customers can be chosen: the first is */
export const Choosing: Story = {
  args: {
    choice: {
      chosen: new Set([ROWS[0]?.id ?? '']),
      onChoose: fn(),
    },
  },
}
