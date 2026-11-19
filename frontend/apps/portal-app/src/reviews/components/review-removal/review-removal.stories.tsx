import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ReviewRemoval } from './review-removal'

const meta: Meta<typeof ReviewRemoval> = {
  title: 'Portal/Reviews/ReviewRemoval',
  component: ReviewRemoval,
  args: {
    open: true,
    subject: 'Beauty Salon Tokyo（2026年11月10日 投稿）',
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The dialog asks */
export const Asking: Story = {}

/** The removal is on its way */
export const Pending: Story = {
  args: { pending: true },
}

/** Nothing came of the attempt, which can be made again */
export const WithMessage: Story = {
  args: {
    message:
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

export const Closed: Story = {
  args: { open: false },
}
