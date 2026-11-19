import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ownReviews } from '../examples'
import { OwnReviewList } from './own-review-list'

const meta: Meta<typeof OwnReviewList> = {
  title: 'Portal/Reviews/OwnReviewList',
  component: OwnReviewList,
  args: {
    reviews: ownReviews,
    total: ownReviews.length,
    more: 'none',
    onMore: fn(),
    timezoneOfReader: 'Asia/Tokyo',
    salonHref: (salonId) => `/salons/${salonId}`,
    changeHref: (reviewId) => `/mypage/reviews/${reviewId}`,
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every review of the list is shown */
export const Complete: Story = {}

/** The list goes on */
export const WithMore: Story = {
  args: { total: 12, more: 'available' },
}

export const LoadingMore: Story = {
  args: { total: 12, more: 'loading' },
}

/** The reviews that come next were asked for and did not come */
export const MoreFailed: Story = {
  args: { total: 12, more: 'failed' },
}

/** The API did not say how many there are */
export const NotCounted: Story = {
  args: { total: null, more: 'available' },
}

/** A salon that went between two requests, and a member of the staff their salon no longer shows */
export const WithoutNames: Story = {
  args: {
    reviews: ownReviews
      .slice(0, 1)
      .map((own) => ({ ...own, salon: null, staffName: null })),
    total: 1,
  },
}
