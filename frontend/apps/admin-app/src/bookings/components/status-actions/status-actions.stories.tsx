import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { moment, salon, WHEN } from '../examples'
import { StatusActions } from './status-actions'

const { status: STATUS } = adminBookingMessages.details

const meta: Meta<typeof StatusActions> = {
  title: 'Admin/Bookings/StatusActions',
  component: StatusActions,
  args: {
    status: 'pending',
    actions: ['confirm', 'cancel'],
    when: WHEN,
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
    recordedStart: momentNameAt(moment(5), salon.timezone),
  },
}

/** The times that were filled in do not go together */
export const CompletionRefused: Story = {
  args: {
    ...AskingCompletion.args,
    completionErrors: {
      actualEndTime: STATUS.completion.endAfterStart,
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
    message: STATUS.failed.cancel,
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
