import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ReportFilter } from './report-filter'

const meta: Meta<typeof ReportFilter> = {
  title: 'Admin/ReviewReports/ReportFilter',
  component: ReportFilter,
  args: {
    shown: 'pending',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The reports that wait, as the screen opens */
export const Pending: Story = {}

/** Every report, as the address asks */
export const All: Story = {
  args: { shown: 'all' },
}
