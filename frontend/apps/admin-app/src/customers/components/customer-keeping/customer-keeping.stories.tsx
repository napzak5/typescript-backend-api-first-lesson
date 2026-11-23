import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { CustomerKeeping } from './customer-keeping'

const meta: Meta<typeof CustomerKeeping> = {
  title: 'Admin/Customers/CustomerKeeping',
  component: CustomerKeeping,
  parameters: {
    // The dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '24rem' } },
  },
  args: {
    keepable: true,
    name: '山田 花子',
    historyHref: `/salons/${salon.id}/customers/${aCustomer().id}/history`,
    mergeHref: `/salons/${salon.id}/customers/${aCustomer().id}/merge`,
    open: false,
    onOpen: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An owner or a manager: the history, and the removal */
export const Keepable: Story = {}

/** A member of the staff is told who does it */
export const ByOthers: Story = {
  args: { keepable: false },
}

/** The dialog asks before the customer is removed */
export const Asking: Story = {
  args: { open: true },
}

/** The removal is on its way */
export const Removing: Story = {
  args: { open: true, pending: true },
}

/** The removal was not sent: said in the dialog, which stays open */
export const NotSent: Story = {
  args: {
    open: true,
    message: adminCustomerMessages.removal.failed,
  },
}

/** The API refused: said here, as another attempt changes nothing */
export const Refused: Story = {
  args: {
    refusal: adminCustomerMessages.removal.unfinished,
  },
}
