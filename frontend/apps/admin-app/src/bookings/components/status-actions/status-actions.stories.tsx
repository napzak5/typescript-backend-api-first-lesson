import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { StatusActions } from './status-actions'

const meta: Meta<typeof StatusActions> = {
  title: 'Admin/Bookings/StatusActions',
  component: StatusActions,
  args: {
    status: 'pending',
    actions: ['confirm', 'cancel'],
    when: '2026年11月20日（金） 10:00〜11:00',
    onAct: fn(),
    onAsk: fn(),
    onClose: fn(),
    onComplete: fn(),
    onCancel: fn(),
    onNoShow: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A booking that waits to be confirmed, before its time */
export const Pending: Story = {}

/** A confirmed booking whose time has come */
export const Confirmed: Story = {
  args: {
    status: 'confirmed',
    actions: ['start', 'complete', 'noShow', 'cancel'],
  },
}

/** The confirmation is on its way */
export const Confirming: Story = {
  args: { pending: 'confirm' },
}

/** A booking that was carried out: nothing more can be done */
export const Completed: Story = {
  args: { status: 'completed', actions: [] },
}

/** The dialog that completes a booking whose treatment began */
export const AskingCompletion: Story = {
  args: {
    status: 'in_progress',
    actions: ['complete'],
    asking: 'complete',
    recordedStart: '2026年11月20日（金） 10:05',
  },
}

/** The times that were filled in do not go together */
export const CompletionRefused: Story = {
  args: {
    ...AskingCompletion.args,
    completionErrors: {
      actualEndTime: '終了は、開始より後の時刻にしてください。',
    },
  },
}

/** The dialog that cancels a booking */
export const AskingCancellation: Story = {
  args: { asking: 'cancel' },
}

/** The cancellation was not sent */
export const CancellationUnsent: Story = {
  args: {
    asking: 'cancel',
    message:
      '予約をキャンセルできませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** The cancellation is on its way */
export const Cancelling: Story = {
  args: { asking: 'cancel', pending: 'cancel' },
}

/** The dialog that records that nobody came */
export const AskingNoShow: Story = {
  args: {
    status: 'confirmed',
    actions: ['start', 'complete', 'noShow', 'cancel'],
    asking: 'noShow',
  },
}
