import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FILE } from '../../utils/attachment-file'
import { AttachmentUpload } from './attachment-upload'

const meta: Meta<typeof AttachmentUpload> = {
  title: 'Admin/Attachments/AttachmentUpload',
  component: AttachmentUpload,
  args: { onSubmit: fn(), onChoose: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

/** No file chosen yet */
export const Empty: Story = {}

/** A file of a kind the API does not take */
export const WithError: Story = {
  args: {
    errors: { [FILE]: adminAttachmentMessages.upload.errors.type },
  },
}

/** The storage did not take the file */
export const NotSent: Story = {
  args: {
    message: adminAttachmentMessages.upload.notSent,
  },
}

/** The file is on its way */
export const Pending: Story = {
  args: { pending: true },
}
