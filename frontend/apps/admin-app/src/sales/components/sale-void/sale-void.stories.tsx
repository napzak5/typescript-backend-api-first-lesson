import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SaleVoid } from './sale-void'

const { void: texts } = adminSaleMessages.changes

const meta: Meta<typeof SaleVoid> = {
  title: 'Admin/Sales/SaleVoid',
  component: SaleVoid,
  args: {
    why: undefined,
    subject: adminSaleMessages.saleNamed('SL-2KQM-9F4H'),
    open: false,
    onOpen: fn(),
    onClose: fn(),
    onVoid: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A sale that can be voided, before the button is pressed */
export const Voidable: Story = {}

/** The dialog asks why */
export const Asking: Story = {
  args: { open: true },
}

/** The voiding is on its way */
export const Pending: Story = {
  args: { open: true, pending: true },
}

/** The reason was left out */
export const WithError: Story = {
  args: {
    open: true,
    errors: { voidReason: texts.reasonMissing },
  },
}

/** Nothing came of the attempt, which can be made again */
export const WithMessage: Story = {
  args: {
    open: true,
    message: texts.failed,
  },
}

/** A sale that is not voided: one with a payment that was received */
export const NotVoidable: Story = {
  args: {
    why: texts.why.received,
  },
}
