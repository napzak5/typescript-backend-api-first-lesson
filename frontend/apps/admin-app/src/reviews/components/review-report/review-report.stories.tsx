import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ReviewReport } from './review-report'

const meta: Meta<typeof ReviewReport> = {
  title: 'Admin/Reviews/ReviewReport',
  component: ReviewReport,
  args: {
    onAsk: fn(),
    onClose: fn(),
    onReport: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What a report is, and its button */
export const Closed: Story = {}

/** The dialog asks why the review is reported */
export const Asking: Story = {
  args: { asking: true },
}

/** «その他» without details */
export const WithErrors: Story = {
  args: {
    asking: true,
    errors: { details: reviewMessages.report.detailsMissing },
  },
}

/** The account reported the review before */
export const ReportedBefore: Story = {
  args: { asking: true, reportedBefore: true },
}
