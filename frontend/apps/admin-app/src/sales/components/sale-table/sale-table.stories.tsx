import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aPaidSale, aPayment, aSale, moment, salon } from '../examples'
import { SaleTable } from './sale-table'

export const ROWS = [
  aSale({
    id: '8b9c0d1e-2f3a-4b4c-9d6e-7f8091021324',
    saleNumber: 'SL-7XWN-3P2R',
    saleTime: moment(240),
    totalAmount: 13200,
    paymentStatus: 'processing',
    payments: [aPayment({ amount: 10000 })],
  }),
  aPaidSale(),
  aSale({
    id: '9c0d1e2f-3a4b-4c5d-8e7f-809102132435',
    saleNumber: 'SL-4F7H-8KQM',
    saleTime: moment(-60),
    totalAmount: 4400,
    paymentStatus: 'completed',
    isVoid: true,
  }),
]

const meta: Meta<typeof SaleTable> = {
  title: 'Admin/Sales/SaleTable',
  component: SaleTable,
  args: {
    caption: '2026年11月20日（金）の売上',
    rows: ROWS,
    total: 3,
    timezone: salon.timezone,
    currency: salon.currency,
    more: 'none',
    onMore: fn(),
    saleHref: (sale) => `/salons/${salon.id}/sales/${sale.id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A sale paid in part, one paid, and one that was voided */
export const Day: Story = {}

/** More sales can be asked for */
export const WithMore: Story = {
  args: { total: 64, more: 'available' },
}
