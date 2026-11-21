import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { uploaderNameOf } from '../../attachment-file'
import { ACCOUNT_ID, FILES_OF_THE_SALON, LEDGER } from '../examples'
import { AttachmentTable } from './attachment-table'

const meta: Meta<typeof AttachmentTable> = {
  title: 'Admin/Attachments/AttachmentTable',
  component: AttachmentTable,
  args: {
    attachments: FILES_OF_THE_SALON,
    timezone: salon.timezone,
    uploaderName: (uploadedBy) =>
      uploaderNameOf(uploadedBy, ACCOUNT_ID, LEDGER),
    attachmentHref: (id) => `/salons/${salon.id}/files/${id}`,
    total: 3,
    more: 'none',
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A form a member uploaded, a photo the account uploaded, and an image of an administrator */
export const Files: Story = {}

/** The first page of more files than it shows */
export const More: Story = {
  args: {
    attachments: FILES_OF_THE_SALON.slice(0, 2),
    total: 23,
    more: 'available',
  },
}
