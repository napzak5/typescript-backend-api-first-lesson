import { ButtonLink } from '@beauty-salon-frontend/ui'
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
  args: { errors: { ownerResponse: '返信を入力してください。' } },
}

/** The answer could not be sent */
export const Failed: Story = {
  args: {
    message:
      '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
