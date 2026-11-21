import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '../badge/badge'
import { DescriptionList } from './description-list'

const meta: Meta<typeof DescriptionList> = {
  title: 'Components/DescriptionList',
  component: DescriptionList,
  args: {
    items: [
      { term: 'お名前', description: '山田 花子' },
      { term: '電話番号', description: '090-1234-5678' },
      { term: 'メールアドレス', description: 'hanako@example.com' },
    ],
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A value can be more than text, and one that was not recorded is said in words. */
export const WithOtherContent: Story = {
  args: {
    items: [
      { term: '状態', description: <Badge tone='success'>確定</Badge> },
      { term: '生年月日', description: null },
    ],
  },
}
