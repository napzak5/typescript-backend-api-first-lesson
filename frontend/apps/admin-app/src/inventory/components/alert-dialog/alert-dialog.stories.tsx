import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { expiredColourAlert, outOfGlovesAlert } from '../examples'
import { AlertDialog } from './alert-dialog'

const meta: Meta<typeof AlertDialog> = {
  title: 'Admin/Inventory/AlertDialog',
  component: AlertDialog,
  parameters: {
    // The dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '36rem' } },
  },
  args: {
    alert: outOfGlovesAlert,
    onClose: fn(),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The gloves, of which none is left */
export const OfAProduct: Story = {}

/** The lot of the colour past its expiry, before anybody saw to it */
export const OfAStockRow: Story = {
  args: { alert: { ...expiredColourAlert, acknowledgement: null } },
}

/** The acknowledgement is on its way */
export const Acknowledging: Story = {
  args: { pending: true },
}

/** The acknowledgement failed, and may be tried again */
export const Failed: Story = {
  args: {
    message:
      'アラートを確認済みにできませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** Closed: nothing is seen to */
export const Closed: Story = {
  args: { alert: undefined },
}
