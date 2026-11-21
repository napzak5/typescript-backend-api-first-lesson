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

/** A highest rating below the lowest */
export const WithErrors: Story = {
  args: {
    conditions: {},
    errors: {
      max: '評価の上限は、下限と同じか、それより高くしてください。',
    },
  },
}
