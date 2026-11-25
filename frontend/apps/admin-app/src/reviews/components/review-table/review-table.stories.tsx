import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon, staff } from '../../../bookings/components/examples'
import { REVIEWS_OF_THE_SALON } from '../examples'
import { ReviewTable } from './review-table'

const meta: Meta<typeof ReviewTable> = {
  title: 'Admin/Reviews/ReviewTable',
  component: ReviewTable,
  args: {
    caption: 'レビュー',
    reviews: REVIEWS_OF_THE_SALON,
    timezone: salon.timezone,
    staff,
    reviewHref: (id) => `/salons/${salon.id}/reviews/${id}`,
    total: 3,
    more: 'none',
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A review that was reported, one not answered, and one the salon answered */
export const Reviews: Story = {}

/** While the staff are read: a member is not named yet */
export const StaffUnread: Story = {
  args: { staff: undefined },
}

/** The member a review rates left the staff of the salon */
export const StaffRemoved: Story = {
  args: { staff: staff.slice(0, 1) },
}

/** The first page of more reviews than it shows */
export const More: Story = {
  args: {
    reviews: REVIEWS_OF_THE_SALON.slice(0, 2),
    total: 23,
    more: 'available',
  },
}
