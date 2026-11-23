import type { ModelsPointTransactionResponse } from '@beauty-salon-frontend/api-client'
import { Link, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { MERGED_CUSTOMER, SALE_GIVEN_FOR, transactions } from '../examples'
import { PointHistory } from './point-history'

const { history: words } = adminCustomerMessages.points

/** The record a transaction was made for, as the screen names it once it is read */
const Reference = ({
  referenceType,
  referenceId,
}: ModelsPointTransactionResponse) => {
  const say = useSay()

  if (referenceType === 'customer') {
    return (
      <Link href={`/salons/${salon.id}/customers/${MERGED_CUSTOMER}`}>
        {say(words.mergedCustomer)}
      </Link>
    )
  }

  return referenceId === SALE_GIVEN_FOR ? (
    <Link href={`/salons/${salon.id}/sales/${SALE_GIVEN_FOR}`}>
      {say(words.saleOf('SL-2KQM-9F4H'))}
    </Link>
  ) : (
    say(words.saleOfOtherSalon)
  )
}

const meta: Meta<typeof PointHistory> = {
  title: 'Admin/Customers/PointHistory',
  component: PointHistory,
  args: {
    transactions,
    total: transactions.length,
    more: 'none',
    onMore: fn(),
    referenceOf: (transaction) => <Reference {...transaction} />,
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
