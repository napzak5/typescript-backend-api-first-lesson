import { Link } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { MERGED_CUSTOMER, SALE_GIVEN_FOR, transactions } from '../examples'
import { PointHistory } from './point-history'

const meta: Meta<typeof PointHistory> = {
  title: 'Admin/Customers/PointHistory',
  component: PointHistory,
  args: {
    transactions,
    total: transactions.length,
    more: 'none',
    onMore: fn(),
    referenceOf: ({ referenceType, referenceId }) => {
      if (referenceType === 'customer') {
        return (
          <Link href={`/salons/${salon.id}/customers/${MERGED_CUSTOMER}`}>
            統合したお客様
          </Link>
        )
      }

      return referenceId === SALE_GIVEN_FOR ? (
        <Link href={`/salons/${salon.id}/sales/${SALE_GIVEN_FOR}`}>
          売上 SL-2KQM-9F4H
        </Link>
      ) : (
        'ほかのサロンの売上'
      )
    },
    timezone: salon.timezone,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A transaction of every kind, with the records they were made for */
export const Transactions: Story = {}

/** More transactions than one page: the rest is asked for */
export const More: Story = {
  args: {
    transactions: transactions.slice(0, 2),
    total: 41,
    more: 'available',
  },
}

/** A customer whose points never moved */
export const Empty: Story = {
  args: { transactions: [], total: 0 },
}
