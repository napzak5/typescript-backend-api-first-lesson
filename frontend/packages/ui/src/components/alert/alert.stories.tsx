import type { Meta, StoryObj } from '@storybook/react-vite'
import { Alert } from './alert'

const meta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
  args: {
    children: '次回のご予約は 12 月 3 日（木）14:00 です。',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Info: Story = {}

export const Success: Story = {
  args: { tone: 'success', children: '予約を受け付けました。' },
}

export const Warning: Story = {
  args: {
    tone: 'warning',
    children: '開始まで 24 時間を切っているため、キャンセル料がかかります。',
  },
}

export const Danger: Story = {
  args: {
    tone: 'danger',
    children: 'メールアドレスまたはパスワードが違います。',
  },
}

export const WithTitle: Story = {
  args: {
    tone: 'danger',
    title: '予約できませんでした',
    children:
      'ご希望の時間に、ほかのお客様の予約が入りました。別の時間をお選びください。',
  },
}
