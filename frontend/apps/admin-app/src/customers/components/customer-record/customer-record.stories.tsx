import type { Meta, StoryObj } from '@storybook/react-vite'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { RECORDED } from '../customer-form/customer-form.stories'
import { CustomerRecord } from './customer-record'

const meta: Meta<typeof CustomerRecord> = {
  title: 'Admin/Customers/CustomerRecord',
  component: CustomerRecord,
  args: {
    customer: aCustomer(),
    timezone: salon.timezone,
    changeHref: `/salons/${salon.id}/customers/${aCustomer().id}/edit`,
    bookingHref: `/salons/${salon.id}/bookings/new?date=2026-11-20&customerId=${aCustomer().id}`,
    customerHref: (customerId) => `/salons/${salon.id}/customers/${customerId}`,
    referrer: undefined,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A customer of whom little is recorded, who has not come yet */
export const Few: Story = {}

/** A customer of whom everything is recorded, referred by another, who has come */
export const Recorded: Story = {
  args: {
    customer: {
      ...RECORDED,
      notes: '駐車場を使う。\n次回は 2 台分。',
      referredBy: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
      firstVisitDate: '2026-01-15',
      lastVisitDate: '2026-11-18',
      visitCount: 14,
      noShowCount: 1,
      cancellationCount: 2,
      loyaltyPoints: 1250,
      updatedAt: '2026-11-18T05:30:00.000Z',
    },
  },
}

/** The customer who referred this one was read, and is named */
export const ReferrerNamed: Story = {
  args: {
    ...Recorded.args,
    referrer: {
      type: 'customer',
      id: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
      name: '鈴木 一郎',
    },
  },
}

/** The customer who referred this one was removed from the ledger */
export const ReferrerGone: Story = {
  args: {
    ...Recorded.args,
    referrer: { type: 'gone', id: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5' },
  },
}

/** A customer who may not book by themselves */
export const Inactive: Story = {
  args: {
    customer: aCustomer({ isActive: false, customerStatus: 'blacklisted' }),
  },
}
