import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, salon } from '../../../bookings/components/examples'
import type { FoundChart } from '../../api/charts-api'
import { aChart } from '../examples'
import { ChartTable } from './chart-table'

/** A chart of the customer of the examples, and one of a customer who left the ledger */
export const ROWS: FoundChart[] = [
  { chart: aChart(), customer: aCustomer() },
  {
    chart: aChart({
      id: 'e5c7a9b1-3d4f-4c6e-8a0b-2f4d6b8c0e13',
      customerId: 'f6d8b0c2-4e5a-4d7f-9b1c-3a5e7c9d1f24',
      medicalConditions: null,
      preferredProducts: [],
      avoidProducts: ['ジアミンを含むカラー剤'],
      updatedAt: '2026-11-10T00:00:00.000Z',
    }),
    customer: undefined,
  },
]

const meta: Meta<typeof ChartTable> = {
  title: 'Admin/Charts/ChartTable',
  component: ChartTable,
  args: {
    caption: 'カルテ',
    rows: ROWS,
    total: 2,
    more: 'none',
    onMore: fn(),
    timezone: 'Asia/Tokyo',
    chartHref: (customerId) =>
      `/salons/${salon.id}/customers/${customerId}/chart`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The charts that were found */
export const Found: Story = {}

/** More charts than were read */
export const More: Story = {
  args: { caption: '条件に合うカルテ', total: 42, more: 'available' },
}
