import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { answeredReview } from '../../../reviews/components/examples'
import { reviewNameOf } from '../../../reviews/utils/review-format'
import { ReviewRemoval } from './review-removal'

const { removal } = adminReviewReportMessages

const meta: Meta<typeof ReviewRemoval> = {
  title: 'Admin/ReviewReports/ReviewRemoval',
  component: ReviewRemoval,
  args: {
    name: reviewNameOf({ ...answeredReview, title: null, overallRating: 3 }),
    onAsk: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What a removal does, and its button */
export const Offered: Story = {}

/** The dialog asks before the review is removed */
export const Asking: Story = {
  args: { asking: true },
}

/** The last attempt did not reach the API */
export const Failed: Story = {
  args: {
    asking: true,
    message: removal.failed,
  },
}

/** Refused to an account that no longer removes reviews */
export const Forbidden: Story = {
  args: {
    refusal: removal.forbidden,
  },
}
