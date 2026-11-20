import type { Meta, StoryObj } from '@storybook/react-vite'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { aChart } from '../examples'
import { ChartRecord } from './chart-record'

const chartHref = `/salons/${salon.id}/customers/${aCustomer().id}/chart`

const meta: Meta<typeof ChartRecord> = {
  title: 'Admin/Charts/ChartRecord',
  component: ChartRecord,
  args: {
    chart: aChart(),
    timezone: 'Asia/Tokyo',
    entryHref: `${chartHref}/new`,
    changeHref: `${chartHref}/edit`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A chart with everything written */
export const Written: Story = {}

/** A chart with nothing written but its customer */
export const Blank: Story = {
  args: {
    chart: aChart({
      previousTreatments: [],
      medicalConditions: null,
      preferredProducts: [],
      avoidProducts: [],
      notes: null,
    }),
  },
}

/** A customer without a chart: what one holds, and the way to make it */
export const NoChart: Story = {
  args: { chart: null },
}
