import type { Meta, StoryObj } from '@storybook/react-vite'
import { services } from '../../../bookings/components/examples'
import { statistics } from '../examples'
import { TreatmentStatistics } from './treatment-statistics'

const meta: Meta<typeof TreatmentStatistics> = {
  title: 'Admin/Treatments/TreatmentStatistics',
  component: TreatmentStatistics,
  args: { statistics, services },
}

export default meta

type Story = StoryObj<typeof meta>

/** A month of records, one of them of a service the salon removed */
export const Counted: Story = {}

/** Records without the time of their treatment */
export const WithoutTime: Story = {
  args: {
    statistics: {
      totalTreatments: 1,
      treatmentsByCategory: [{ category: 'other', count: 1 }],
      averageProcessingTime: null,
      topServices: [],
    },
  },
}
