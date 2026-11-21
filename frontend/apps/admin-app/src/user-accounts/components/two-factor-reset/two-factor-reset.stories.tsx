import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ADMINISTRATORS_ONLY } from '../../user-accounts'
import { EMAIL } from '../examples'
import { TwoFactorReset } from './two-factor-reset'

const meta: Meta<typeof TwoFactorReset> = {
  title: 'Admin/UserAccounts/TwoFactorReset',
  component: TwoFactorReset,
  args: {
    email: EMAIL,
    onAsk: fn(),
    onClose: fn(),
    onReset: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What a reset does, and its button */
export const Offered: Story = {}

/** The dialog asks before the second factor is reset */
export const Asking: Story = {
  args: { asking: true },
}

/** The last attempt did not reach the API */
export const Failed: Story = {
  args: {
    asking: true,
    message:
      '2 要素認証をリセットできませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** Refused to an account that does not look after accounts */
export const Forbidden: Story = {
  args: { refusal: ADMINISTRATORS_ONLY },
}
