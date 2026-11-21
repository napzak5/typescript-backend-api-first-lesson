import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LoadMore } from './load-more'

const meta: Meta<typeof LoadMore> = {
  title: 'Components/LoadMore',
  component: LoadMore,
  args: { more: 'available', onMore: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

export const Available: Story = {}

export const Loading: Story = {
  args: { more: 'loading' },
}

/** The page that was asked for did not come: why, and the button that asks again */
export const Failed: Story = {
  args: { more: 'failed' },
}

/** Every page was read: nothing is shown */
export const NothingMore: Story = {
  args: { more: 'none' },
}
