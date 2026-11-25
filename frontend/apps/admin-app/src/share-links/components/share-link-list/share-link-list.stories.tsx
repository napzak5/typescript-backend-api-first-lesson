import { FAILED, unreadMessageOf } from '@beauty-salon-frontend/answers'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { consentForm } from '../../../attachments/components/examples'
import { salon } from '../../../bookings/components/examples'
import { NOW, SHARE_LINKS_OF_THE_FILE } from '../examples'
import { ShareLinkList } from './share-link-list'

const FILE = `/salons/${salon.id}/files/${consentForm.id}`

const meta: Meta<typeof ShareLinkList> = {
  title: 'Admin/ShareLinks/ShareLinkList',
  component: ShareLinkList,
  args: {
    listing: {
      type: 'listed',
      shareLinks: SHARE_LINKS_OF_THE_FILE,
      total: 3,
      more: 'none',
    },
    timezone: salon.timezone,
    now: NOW,
    entryHref: `${FILE}/share-links/new`,
    shareLinkHref: (id) => `${FILE}/share-links/${id}`,
    onRetry: fn(),
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A link the customer still uses, one used up, and one that ran out */
export const Listed: Story = {}

/** The first page of more links than it shows */
export const More: Story = {
  args: {
    listing: {
      type: 'listed',
      shareLinks: SHARE_LINKS_OF_THE_FILE.slice(0, 2),
      total: 23,
      more: 'available',
    },
  },
}

/** A file that was never shared */
export const NoneIssued: Story = {
  args: {
    listing: { type: 'listed', shareLinks: [], total: 0, more: 'none' },
  },
}

/** While the links are read */
export const Reading: Story = {
  args: { listing: { type: 'reading' } },
}

/** The links could not be read */
export const Unread: Story = {
  args: {
    listing: {
      type: 'unread',
      message: unreadMessageOf(adminShareLinkMessages.names.shareLinks, FAILED),
    },
  },
}
