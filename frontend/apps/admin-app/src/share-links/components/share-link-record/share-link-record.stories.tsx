import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { forTheCustomer, NOW, ranOut, usedUp } from '../examples'
import { ShareLinkRecord } from './share-link-record'

const meta: Meta<typeof ShareLinkRecord> = {
  title: 'Admin/ShareLinks/ShareLinkRecord',
  component: ShareLinkRecord,
  args: {
    shareLink: forTheCustomer,
    timezone: salon.timezone,
    now: NOW,
    issuerName: 'あなた',
    onAsk: fn(),
    onClose: fn(),
    onRevoke: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A link the customer still uses, which the account issued */
export const Usable: Story = {}

/** A link that gave its file as often as it may */
export const UsedUp: Story = {
  args: { shareLink: usedUp },
}

/** A link that ran out, which a member of the staff issued */
export const RanOut: Story = {
  args: { shareLink: ranOut, issuerName: '佐藤 美咲' },
}

/** The dialog asks before the link is revoked */
export const Asking: Story = {
  args: { asking: true },
}

/** The revocation could not be sent */
export const RevocationFailed: Story = {
  args: {
    asking: true,
    message:
      '共有リンクを取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
