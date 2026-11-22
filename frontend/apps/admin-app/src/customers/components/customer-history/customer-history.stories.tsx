import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { changerNameOf } from '../../utils/customer-history'
import { CUSTOMER_ACCOUNT, history, ME } from '../examples'
import { CustomerHistory } from './customer-history'

const meta: Meta<typeof CustomerHistory> = {
  title: 'Admin/Customers/CustomerHistory',
  component: CustomerHistory,
  args: {
    entries: history,
    total: history.length,
    more: 'none',
    onMore: fn(),
    versionHref: (version) =>
      `/salons/${salon.id}/customers/${aCustomer().id}/history/${version}`,
    changerOf: (changedBy) =>
      changerNameOf(changedBy, { me: ME, customer: CUSTOMER_ACCOUNT }),
    timezone: salon.timezone,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every version of a customer: changes by the salon and by the customer, one that changed nothing, and the start */
export const Versions: Story = {}

/** More versions than one page: the rest is asked for */
export const More: Story = {
  args: { entries: history.slice(0, 2), total: 41, more: 'available' },
}
