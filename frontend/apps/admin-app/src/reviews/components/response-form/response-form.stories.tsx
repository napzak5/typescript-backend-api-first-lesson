import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { answeredReview, unansweredReview } from '../examples'
import { ResponseForm } from './response-form'

const meta: Meta<typeof ResponseForm> = {
  title: 'Admin/Reviews/ResponseForm',
  component: ResponseForm,
  args: {
    review: unansweredReview,
    timezone: salon.timezone,
    actions: (
      <ButtonLink
        href={`/salons/${salon.id}/reviews/${unansweredReview.id}`}
        variant='quiet'
      >
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A review the salon did not answer yet, without a comment */
export const FirstAnswer: Story = {}

/** The answer the review holds, to be changed */
export const Change: Story = {
  args: { review: answeredReview },
}

/** An answer of spaces alone */
export const WithErrors: Story = {
  args: { errors: { ownerResponse: adminReviewMessages.response.missing } },
}

/** The answer could not be sent */
export const Failed: Story = {
  args: {
    message: adminReviewMessages.response.failed,
  },
}
