import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { fullReview, reviews } from '../examples'
import { ReviewList, type ReviewListCustomer } from './review-list'

const meta: Meta<typeof ReviewList> = {
  title: 'Portal/Salons/ReviewList',
  component: ReviewList,
  args: {
    reviews,
    timezone: 'Asia/Tokyo',
    sortBy: 'recent',
    onSortChange: fn(),
    more: 'none',
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A customer who wrote none of the reviews */
const customer: ReviewListCustomer = {
  customerId: 'e7092b4c-68fd-4a13-9b35-d7f902245846',
  helpful: new Set(),
  sending: undefined,
  changeHref: (reviewId) => `/mypage/reviews/${reviewId}`,
  onHelpful: fn(),
  onReport: fn(),
}

/**
 * A review with everything (ratings in detail, an answer of the salon), one
 * without a title, and one without a text
 */
export const Complete: Story = {}

/** The list goes on: the next reviews can be asked for */
export const WithMore: Story = {
  args: { more: 'available' },
}

export const LoadingMore: Story = {
  args: { more: 'loading' },
}

/** The next reviews were asked for and did not come */
export const MoreFailed: Story = {
  args: { more: 'failed' },
}

export const BestRatedFirst: Story = {
  args: { sortBy: 'rating' },
}

/** A customer reads: every review has the button that finds it helpful and the one that reports it */
export const ForACustomer: Story = {
  args: { customer },
}

/** The customer wrote the second review: it has the link to the form that changes it */
export const WithOwnReview: Story = {
  args: {
    customer,
    reviews: reviews.map((review, index) =>
      index === 1 ? { ...review, customerId: customer.customerId } : review,
    ),
  },
}

/** The customer said that the first review was helpful */
export const WithHelpfulSaid: Story = {
  args: { customer: { ...customer, helpful: new Set([fullReview.id]) } },
}

/** The customer is saying so: the answer is on its way */
export const SayingHelpful: Story = {
  args: { customer: { ...customer, sending: fullReview.id } },
}
