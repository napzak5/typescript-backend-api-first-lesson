import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { consentForm } from '../../../attachments/components/examples'
import { ShareLinkForm } from './share-link-form'

const meta: Meta<typeof ShareLinkForm> = {
  title: 'Admin/ShareLinks/ShareLinkForm',
  component: ShareLinkForm,
  args: {
    filename: consentForm.filename,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** As the form opens: seven days, no limit and no password */
export const Empty: Story = {}

/** The API refused the password as too easy to guess */
export const PasswordGuessed: Story = {
  args: {
    errors: {
      password:
        '推測されやすいパスワードです。連番、キーボードの並び、同じ文字の繰り返し、よく使われるパスワードは使えません。ほかのパスワードにしてください。',
    },
  },
}

/** While the link is issued */
export const Pending: Story = {
  args: { pending: true },
}

/** The link could not be issued */
export const Failed: Story = {
  args: {
    message:
      '共有リンクを発行できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
