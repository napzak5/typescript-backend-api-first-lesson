import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { UnreadNotice } from './unread-notice'

const meta: Meta<typeof UnreadNotice> = {
  title: 'Components/UnreadNotice',
  component: UnreadNotice,
  args: {
    message:
      'メニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    onRetry: fn(),
    retrying: false,
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Unread: Story = {}

/** The API is being asked again */
export const Retrying: Story = {
  args: { retrying: true },
}
