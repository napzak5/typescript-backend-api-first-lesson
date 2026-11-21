import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ReviewRemoval } from './review-removal'

const meta: Meta<typeof ReviewRemoval> = {
  title: 'Admin/ReviewReports/ReviewRemoval',
  component: ReviewRemoval,
  args: {
    name: '評価 3 のレビュー',
    onAsk: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What a removal does, and its button */
export const Offered: Story = {}

/** The dialog asks before the review is removed */
export const Asking: Story = {
  args: { asking: true },
}

/** The last attempt did not reach the API */
export const Failed: Story = {
  args: {
    asking: true,
    message:
      'レビューを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** Refused to an account that no longer removes reviews */
export const Forbidden: Story = {
  args: {
    refusal:
      'このアカウントでは、このレビューを削除できません。レビューを削除できるのは、書いたお客様と、管理者です。',
  },
}
