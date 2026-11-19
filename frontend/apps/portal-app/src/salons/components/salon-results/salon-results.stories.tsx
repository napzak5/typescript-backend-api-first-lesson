import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { plainSalon, salon } from '../examples'
import { SalonResults } from './salon-results'

const meta: Meta<typeof SalonResults> = {
  title: 'Portal/Salons/SalonResults',
  component: SalonResults,
  args: {
    salons: [salon, plainSalon],
    total: 2,
    more: 'none',
    onMore: fn(),
    salonHref: ({ id }) => `/salons/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every salon that was found is shown */
export const Complete: Story = {}

/** The list goes on: the next salons can be asked for */
export const WithMore: Story = {
  args: { total: 41, more: 'available' },
}

export const LoadingMore: Story = {
  args: { total: 41, more: 'loading' },
}

/** The next salons were asked for and did not come */
export const MoreFailed: Story = {
  args: { total: 41, more: 'failed' },
}

/** The API did not say how many salons there are */
export const NotCounted: Story = {
  args: { total: null, more: 'available' },
}
