import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { reviewActionNoteOf } from '../../utils/review-actions'
import { answeredReview, unansweredReview } from '../examples'
import { ReviewAnswer } from './review-answer'

const meta: Meta<typeof ReviewAnswer> = {
  title: 'Admin/Reviews/ReviewAnswer',
  component: ReviewAnswer,
  args: {
    review: answeredReview,
    timezone: salon.timezone,
    responseHref: `/salons/${salon.id}/reviews/${answeredReview.id}/response`,
    withdraws: true,
    onAsk: fn(),
    onClose: fn(),
    onWithdraw: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The answer of the salon, which the owner changes or withdraws */
export const Answered: Story = {}

/** A review the salon did not answer yet */
export const Unanswered: Story = {
  args: {
    review: unansweredReview,
    responseHref: `/salons/${salon.id}/reviews/${unansweredReview.id}/response`,
  },
}

/** An administrator withdraws an answer, and writes none */
export const ForAdministrator: Story = {
  args: { responseHref: undefined, note: reviewActionNoteOf('admin') },
}

/** A member of the staff reads the answer */
export const ForStaff: Story = {
  args: {
    responseHref: undefined,
    withdraws: false,
    note: reviewActionNoteOf('staff'),
  },
}

/** The dialog asks before the answer is withdrawn */
export const Asking: Story = {
  args: { asking: true },
}

/** The withdrawal could not be sent */
export const WithdrawalFailed: Story = {
  args: {
    asking: true,
    message: adminReviewMessages.withdrawal.failed,
  },
}
