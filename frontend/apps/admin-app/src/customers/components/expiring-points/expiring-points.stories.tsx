import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { expiring } from '../examples'
import { ExpiringPoints } from './expiring-points'

const meta: Meta<typeof ExpiringPoints> = {
  title: 'Admin/Customers/ExpiringPoints',
  component: ExpiringPoints,
  args: {
    expiring,
    days: 30,
    today: '2026-11-20',
    timezone: salon.timezone,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Points that expire soon, and points whose day is past and that were not expired */
export const Expiring: Story = {}

/** Points that expire soon, none of them past */
export const Soon: Story = {
  args: {
    expiring: {
      ...expiring,
      expiringPoints: 500,
      expirationDate: '2026-12-10',
      transactions: expiring.transactions.slice(1),
    },
  },
}

/** No point expires within the days */
export const None: Story = {
  args: {
    expiring: {
      ...expiring,
      expiringPoints: 0,
      expirationDate: null,
      transactions: [],
    },
  },
}
