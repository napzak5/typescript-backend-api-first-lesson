import type { Meta, StoryObj } from '@storybook/react-vite'
import { emptyReviewSummary, reviewSummary } from '../examples'
import { ReviewSummary } from './review-summary'

const meta: Meta<typeof ReviewSummary> = {
  title: 'Portal/Salons/ReviewSummary',
  component: ReviewSummary,
  args: { summary: reviewSummary },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Nobody wrote a review yet */
export const NoReviews: Story = {
  args: { summary: emptyReviewSummary },
}

/** The API left out the ratings nobody gave */
export const SomeRatingsNotGiven: Story = {
  args: {
    summary: {
      averageRating: 4.5,
      totalReviews: 2,
      ratingDistribution: { '4': 1, '5': 1 },
    },
  },
}
