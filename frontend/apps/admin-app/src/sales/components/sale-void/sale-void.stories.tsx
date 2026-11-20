import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SaleVoid } from './sale-void'

const meta: Meta<typeof SaleVoid> = {
  title: 'Admin/Sales/SaleVoid',
  component: SaleVoid,
  args: {
    why: undefined,
    subject: '売上番号 SL-2KQM-9F4H',
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
    errors: { voidReason: '取り消しの理由を入力してください。' },
  },
}

/** Nothing came of the attempt, which can be made again */
export const WithMessage: Story = {
  args: {
    open: true,
    message:
      '売上を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** A sale that is not voided: one with a payment that was received */
export const NotVoidable: Story = {
  args: {
    why: '受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。',
  },
}
