import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CustomerRequests } from './customer-requests'

const meta: Meta<typeof CustomerRequests> = {
  title: 'Admin/Customers/CustomerRequests',
  component: CustomerRequests,
  args: {
    answerable: true,
    onExport: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An owner or a manager: the data is exported */
export const Answerable: Story = {}

/** A member of the staff is told who answers */
export const ByOthers: Story = {
  args: { answerable: false },
}

/** The data is on its way */
export const Exporting: Story = {
  args: { exporting: true },
}

/** No file was saved: said above the button, which may be pressed again */
export const NotSaved: Story = {
  args: {
    message:
      'お客様のデータを出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
