import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { dayOf } from '@beauty-salon-shared/i18n/formats'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ReviewRemoval } from './review-removal'

const meta: Meta<typeof ReviewRemoval> = {
  title: 'Portal/Reviews/ReviewRemoval',
  component: ReviewRemoval,
  args: {
    open: true,
    subject: portalReviewMessages.subject(
      'Beauty Salon Tokyo',
      dayOf('2026-11-10'),
    ),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The dialog asks */
export const Asking: Story = {}

/** The removal is on its way */
export const Pending: Story = {
  args: { pending: true },
}

/** Nothing came of the attempt, which can be made again */
export const WithMessage: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}

export const Closed: Story = {
  args: { open: false },
}
