import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Select } from './select'

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  args: {
    label: '担当スタッフ',
    name: 'staffId',
    placeholder: '選択してください',
    options: [
      { value: 'sato', label: '佐藤 美咲' },
      { value: 'suzuki', label: '鈴木 健' },
      { value: 'takahashi', label: '高橋 彩' },
    ],
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Chosen: Story = {
  args: { defaultValue: 'suzuki' },
}

export const WithDescription: Story = {
  args: { description: '指名料はかかりません' },
}

export const Required: Story = {
  args: { required: true },
}

export const WithError: Story = {
  args: { required: true, error: '担当スタッフを選択してください' },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'sato' },
}
