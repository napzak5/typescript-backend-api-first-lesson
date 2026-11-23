import { unreadMessageOf } from '@beauty-salon-frontend/answers'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aDeletionRequest, ME } from '../examples'
import { CustomerErasure } from './customer-erasure'

const { erasure: words } = adminCustomerMessages

const meta: Meta<typeof CustomerErasure> = {
  title: 'Admin/Customers/CustomerErasure',
  component: CustomerErasure,
  args: {
    name: '田中 優希',
    timezone: 'Asia/Tokyo',
    shown: { type: 'read', request: null },
    onRetry: fn(),
    requestable: true,
    dialog: 'none',
    onOpen: fn(),
    onClose: fn(),
    onAsk: fn(),
    onCancel: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The customer never asked: what erasing does, and the button that takes a request */
export const NoRequest: Story = {}

/** The dialog that takes a request asks for its reason */
export const Asking: Story = {
  args: { dialog: 'ask' },
}

/** The reason was left blank: said under it, and nothing was sent */
export const BlankReason: Story = {
  args: {
    dialog: 'ask',
    errors: { reason: words.asking.blankReason },
  },
}

/** The request could not be sent: said in the dialog, which may send it again */
export const NotAsked: Story = {
  args: {
    dialog: 'ask',
    message: words.askFailed,
  },
}

/** A pending request: its moments and its reason, and the button that calls it off */
export const Pending: Story = {
  args: { shown: { type: 'read', request: aDeletionRequest() } },
}

/** The dialog that calls a pending request off */
export const Cancelling: Story = {
  args: {
    shown: { type: 'read', request: aDeletionRequest() },
    dialog: 'cancel',
  },
}

/** The calling off is on its way: its button is busy */
export const CallingOff: Story = {
  args: {
    shown: { type: 'read', request: aDeletionRequest() },
    dialog: 'cancel',
    pending: true,
  },
}

/** A request that was called off: a new one is taken */
export const Cancelled: Story = {
  args: {
    shown: {
      type: 'read',
      request: aDeletionRequest({
        status: 'cancelled',
        cancelledBy: ME,
        cancelledAt: '2026-11-21T06:00:00.000Z',
      }),
    },
  },
}

/** The data was erased: the salon lets the customer know */
export const Completed: Story = {
  args: {
    requestable: false,
    shown: {
      type: 'read',
      request: aDeletionRequest({
        status: 'completed',
        completedBy: ME,
        completedAt: '2026-12-05T00:00:00.000Z',
      }),
    },
  },
}

/** A customer who left the ledger and never asked: no request is taken */
export const RemovedWithoutRequest: Story = {
  args: { requestable: false },
}

/** Another account took a request meanwhile: said under the heading */
export const TakenMeanwhile: Story = {
  args: {
    shown: { type: 'read', request: aDeletionRequest() },
    refusal: words.takenMeanwhile,
  },
}

/** The request is being read */
export const Reading: Story = {
  args: { shown: { type: 'reading' } },
}

/** The request could not be read */
export const Unread: Story = {
  args: {
    shown: {
      type: 'unread',
      message: unreadMessageOf(words.names.request, { type: 'failed' }),
      retrying: false,
    },
  },
}
