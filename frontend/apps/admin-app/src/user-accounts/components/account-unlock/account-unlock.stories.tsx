import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { AccountUnlock } from './account-unlock'

const meta: Meta<typeof AccountUnlock> = {
  title: 'Admin/UserAccounts/AccountUnlock',
  component: AccountUnlock,
  args: { onUnlock: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

/** What the lifting does, and its button */
export const Offered: Story = {}

/** The lifting is on its way */
export const Pending: Story = {
  args: { pending: true },
}

/** The last attempt did not reach the API */
export const Failed: Story = {
  args: {
    message:
      'ロックを解除できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
