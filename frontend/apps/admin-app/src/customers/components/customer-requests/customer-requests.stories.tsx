import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CustomerErasure } from '../customer-erasure/customer-erasure'
import { aDeletionRequest } from '../examples'
import { CustomerRequests } from './customer-requests'

/** The part of the erasure, as the page of a customer shows it */
const erasure = (
  <CustomerErasure
    name='田中 優希'
    timezone='Asia/Tokyo'
    shown={{ type: 'read', request: null }}
    onRetry={fn()}
    requestable
    dialog='none'
    onOpen={fn()}
    onClose={fn()}
    onAsk={fn()}
    onCancel={fn()}
  />
)

const meta: Meta<typeof CustomerRequests> = {
  title: 'Admin/Customers/CustomerRequests',
  component: CustomerRequests,
  args: {
    answerable: true,
    dataExport: { onExport: fn() },
    children: erasure,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An owner or a manager: the data is exported, and a request to erase it is taken */
export const Answerable: Story = {}

/** A member of the staff is told who answers */
export const ByOthers: Story = {
  args: { answerable: false },
}

/** The data is on its way */
export const Exporting: Story = {
  args: { dataExport: { exporting: true, onExport: fn() } },
}

/** No file was saved: said above the button, which may be pressed again */
export const NotSaved: Story = {
  args: {
    dataExport: {
      message: adminCustomerMessages.exports.data.failed,
      onExport: fn(),
    },
  },
}

/** A customer who left the ledger: their data is not exported, and their pending request is called off */
export const Removed: Story = {
  args: {
    dataExport: undefined,
    children: (
      <CustomerErasure
        name='田中 優希'
        timezone='Asia/Tokyo'
        shown={{ type: 'read', request: aDeletionRequest() }}
        onRetry={fn()}
        requestable={false}
        dialog='none'
        onOpen={fn()}
        onClose={fn()}
        onAsk={fn()}
        onCancel={fn()}
      />
    ),
  },
}
