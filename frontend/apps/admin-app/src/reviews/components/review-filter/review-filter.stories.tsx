import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon, staff } from '../../../bookings/components/examples'
import { ReviewFilter } from './review-filter'

const meta: Meta<typeof ReviewFilter> = {
  title: 'Admin/Reviews/ReviewFilter',
  component: ReviewFilter,
  args: {
    conditions: {},
    staff,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every review of the salon, the latest first */
export const Every: Story = {}

/** The reviews of three or less of a member of the staff, the most helpful first */
export const Narrowed: Story = {
  args: {
    conditions: {
      maxRating: 3,
      staff: staff[1]?.id ?? '',
      order: 'helpful',
    },
    clearHref: `/salons/${salon.id}/reviews`,
  },
}

/** The reviews of four or more */
export const FromFour: Story = {
  args: {
    conditions: { minRating: 4 },
    clearHref: `/salons/${salon.id}/reviews`,
  },
}

/** A highest rating below the lowest */
export const WithErrors: Story = {
  args: {
    conditions: {},
    errors: { max: adminReviewMessages.list.rangeReversed },
  },
}
