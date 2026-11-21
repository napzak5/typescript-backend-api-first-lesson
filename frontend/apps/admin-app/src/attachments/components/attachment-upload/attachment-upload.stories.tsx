import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FILE } from '../../attachment-file'
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
    errors: {
      [FILE]: 'JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。',
    },
  },
}

/** The storage did not take the file */
export const NotSent: Story = {
  args: {
    message:
      'ファイルを送れませんでした。通信の状態を確かめて、もう一度アップロードしてください。',
  },
}

/** The file is on its way */
export const Pending: Story = {
  args: { pending: true },
}
