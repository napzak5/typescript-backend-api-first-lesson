import type { Meta, StoryObj } from '@storybook/react-vite'
import { summaryOfTheSalon } from '../examples'
import { ReviewSummary } from './review-summary'

const meta: Meta<typeof ReviewSummary> = {
  title: 'Admin/Reviews/ReviewSummary',
  component: ReviewSummary,
  args: { summary: summaryOfTheSalon },
}

export default meta

type Story = StoryObj<typeof meta>

/** Three reviews: one of each of five, four and three */
export const Reviewed: Story = {}

/** A salon nobody reviewed yet */
export const NoReviews: Story = {
  args: {
    summary: {
      averageRating: null,
      totalReviews: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    },
  },
}
