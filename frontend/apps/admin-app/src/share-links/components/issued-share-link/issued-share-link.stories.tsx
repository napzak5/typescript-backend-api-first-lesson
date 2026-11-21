import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { consentForm } from '../../../attachments/components/examples'
import { salon } from '../../../bookings/components/examples'
import { forTheCustomer, TOKEN, usedUp } from '../examples'
import { IssuedShareLink } from './issued-share-link'

const FILE = `/salons/${salon.id}/files/${consentForm.id}`

const meta: Meta<typeof IssuedShareLink> = {
  title: 'Admin/ShareLinks/IssuedShareLink',
  component: IssuedShareLink,
  args: {
    address: `https://beauty-salon.example/share#token=${TOKEN}`,
    shareLink: forTheCustomer,
    timezone: salon.timezone,
    copying: 'notCopied',
    onCopy: fn(),
    shareLinkHref: `${FILE}/share-links/${forTheCustomer.id}`,
    fileHref: FILE,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A link with a password and a limit, as it was issued */
export const WithPassword: Story = {}

/** A link without a password, which gives the file once */
export const WithoutPassword: Story = {
  args: { shareLink: { ...usedUp, downloadCount: 0 } },
}

/** The link was put on the clipboard */
export const Copied: Story = {
  args: { copying: 'copied' },
}

/** The browser did not let the page write to the clipboard */
export const CopyFailed: Story = {
  args: { copying: 'failed' },
}
