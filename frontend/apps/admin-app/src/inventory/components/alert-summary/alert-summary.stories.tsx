import type { Meta, StoryObj } from '@storybook/react-vite'
import { SUMMARY_OF_THE_SALON } from '../examples'
import { AlertSummary } from './alert-summary'

const meta: Meta<typeof AlertSummary> = {
  title: 'Admin/Inventory/AlertSummary',
  component: AlertSummary,
  args: { summary: SUMMARY_OF_THE_SALON },
}

export default meta

type Story = StoryObj<typeof meta>

/** Two alerts, one of which nobody saw to */
export const Alerts: Story = {}

/** Somebody saw to every alert */
export const AllAcknowledged: Story = {
  args: { summary: { ...SUMMARY_OF_THE_SALON, unacknowledged: 0 } },
}

/** Nothing to see to */
export const NoAlerts: Story = {
  args: {
    summary: {
      totalAlerts: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
      unacknowledged: 0,
    },
  },
}
