import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { REVIEWS_OF_THE_SALON } from '../../../reviews/components/examples'
import { reviewNameOf } from '../../../reviews/utils/review-format'
import { REPORTS, reportWithDetails, waitingReport } from '../examples'
import { ReportTable } from './report-table'

const reviewOf = (reviewId: string) => {
  const review = REVIEWS_OF_THE_SALON.find(({ id }) => id === reviewId)

  return {
    name: review === undefined ? '削除されたレビュー' : reviewNameOf(review),
    href: `/salons/${salon.id}/reviews/${reviewId}`,
  }
}

const meta: Meta<typeof ReportTable> = {
  title: 'Admin/ReviewReports/ReportTable',
  component: ReportTable,
  args: {
    caption: '通報',
    reports: REPORTS,
    timezone: salon.timezone,
    reviewOf,
    total: 3,
    more: 'none',
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The reports of the reviews of a salon: one dismissed, and two that wait, one of them with details */
export const OfTheSalon: Story = {}

/** The reports that wait, with more to read */
export const More: Story = {
  args: {
    caption: '未処理の通報',
    reports: [waitingReport, reportWithDetails],
    total: 23,
    more: 'available',
  },
}

/** The reports of one review: no review named, and those that wait dismissed from their rows */
export const OfOneReview: Story = {
  args: {
    caption: 'このレビューへの通報',
    reviewOf: undefined,
    onDismiss: fn(),
  },
}
