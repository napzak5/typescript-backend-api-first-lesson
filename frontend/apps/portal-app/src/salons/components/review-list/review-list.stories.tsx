import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { reviews } from '../examples'
import { ReviewList } from './review-list'

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
