import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { consentForm, photo } from '../examples'
import { AttachmentRecord } from './attachment-record'

/** An image that stands for the photo: the storage of the examples is nowhere */
const PICTURE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22480%22 height=%22320%22%3E%3Crect width=%22480%22 height=%22320%22 fill=%22%23d9cfc7%22/%3E%3C/svg%3E'

const meta: Meta<typeof AttachmentRecord> = {
  title: 'Admin/Attachments/AttachmentRecord',
  component: AttachmentRecord,
  args: {
    attachment: photo,
    timezone: salon.timezone,
    uploaderName: 'あなた',
    links: { type: 'issued', open: PICTURE, save: `${PICTURE}#save` },
    onRetryLinks: fn(),
    removes: true,
    onAsk: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A photo the account uploaded: shown, opened, saved and removed */
export const Photo: Story = {}

/** A PDF a member uploaded, which the account may not remove */
export const DocumentOfAnother: Story = {
  args: {
    attachment: consentForm,
    uploaderName: '佐藤 美咲',
    links: {
      type: 'issued',
      open: 'https://storage.salon.example/consent.pdf?inline',
      save: 'https://storage.salon.example/consent.pdf',
    },
    removes: false,
  },
}

/** While the URLs are read */
export const Reading: Story = {
  args: { links: { type: 'reading' } },
}

/** The URLs could not be read */
export const Unread: Story = {
  args: {
    links: {
      type: 'unread',
      message:
        'ファイルを開くアドレスを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    },
  },
}

/** The dialog asks before the file is removed */
export const Asking: Story = {
  args: { asking: true },
}

/** The removal could not be sent */
export const RemovalFailed: Story = {
  args: {
    asking: true,
    message:
      'ファイルを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
