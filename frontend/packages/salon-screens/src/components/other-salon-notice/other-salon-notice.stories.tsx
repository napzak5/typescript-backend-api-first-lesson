import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { OtherSalonNotice } from './other-salon-notice'

const meta: Meta<typeof OtherSalonNotice> = {
  title: 'SalonScreens/OtherSalonNotice',
  component: OtherSalonNotice,
}

export default meta

const { names } = dashboardReportMessages

type Story = StoryObj<typeof meta>

/** The bookings of another salon, which its staff and the administrators see */
export const Bookings: Story = {}

/** The sales report of another salon, as the dashboard names it, and the start of the dashboard */
export const SalesReport: Story = {
  args: { what: names.seen.report, who: names.who, start: names.seen.report },
}
