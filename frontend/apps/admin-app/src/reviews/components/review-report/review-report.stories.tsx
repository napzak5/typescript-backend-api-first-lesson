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
    errors: {
      details: '「その他」を選んだときは、何が問題かを入力してください。',
    },
  },
}

/** The account reported the review before */
export const ReportedBefore: Story = {
  args: { asking: true, reportedBefore: true },
}
