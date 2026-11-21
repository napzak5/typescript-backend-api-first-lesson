import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { OrderStatusActions } from './order-status-actions'

const meta: Meta<typeof OrderStatusActions> = {
  title: 'Admin/PurchaseOrders/OrderStatusActions',
  component: OrderStatusActions,
  args: {
    order: { status: 'draft', orderNumber: 'PO-7K3M-Q9TX' },
    actions: ['submit', 'cancel'],
    onAct: fn(),
    onAsk: fn(),
    onClose: fn(),
    onCancel: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A draft, seen by a manager */
export const Draft: Story = {}

/** An order that waits for approval, seen by a manager */
export const Pending: Story = {
  args: {
    order: { status: 'pending', orderNumber: 'PO-7K3M-Q9TX' },
    actions: ['approve', 'cancel'],
  },
}

/** An order that waits for approval, seen by a stylist: they wait for the approvers */
export const PendingForAStylist: Story = {
  args: {
    order: { status: 'pending', orderNumber: 'PO-7K3M-Q9TX' },
    actions: [],
    note: '発注を承認し、取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
  },
}

/** An approved order, seen by a stylist: they record that it was ordered */
export const ApprovedForAStylist: Story = {
  args: {
    order: { status: 'approved', orderNumber: 'PO-7K3M-Q9TX' },
    actions: ['order'],
    note: '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
  },
}

/** An order placed with the supplier, seen by a manager: its goods are received on a screen of their own */
export const Ordered: Story = {
  args: {
    order: { status: 'ordered', orderNumber: 'PO-2H8R-W4VN' },
    actions: ['ship', 'cancel'],
    receiveHref: '/salons/salon/purchase-orders/order/receive',
  },
}

/** A shipped order, seen by a stylist: they record the goods that came */
export const ShippedForAStylist: Story = {
  args: {
    order: { status: 'shipped', orderNumber: 'PO-2H8R-W4VN' },
    actions: [],
    note: '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
    receiveHref: '/salons/salon/purchase-orders/order/receive',
  },
}

/** The approval is on its way */
export const Approving: Story = {
  args: { ...Pending.args, pending: 'approve' },
}

/** A delivered order: nothing more can be done */
export const Delivered: Story = {
  args: {
    order: { status: 'delivered', orderNumber: 'PO-7K3M-Q9TX' },
    actions: [],
    note: 'この発注は納品済みです。ステータスは、もう変わりません。',
  },
}

/** The dialog that cancels an order */
export const AskingCancellation: Story = {
  args: { asking: true },
}

/** The dialog that cancels a shipped order: the goods may come back */
export const AskingCancellationOfAShippedOrder: Story = {
  args: {
    order: { status: 'shipped', orderNumber: 'PO-2H8R-W4VN' },
    actions: ['cancel'],
    asking: true,
  },
}

/** The reason was left empty */
export const CancellationRefused: Story = {
  args: {
    asking: true,
    cancellationErrors: {
      cancellationReason: '取り消す理由を入力してください。',
    },
  },
}

/** The cancellation was not sent */
export const CancellationUnsent: Story = {
  args: {
    asking: true,
    message:
      '発注を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** The cancellation is on its way */
export const Cancelling: Story = {
  args: { asking: true, pending: 'cancel' },
}
