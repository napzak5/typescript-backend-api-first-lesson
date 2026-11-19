import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TextArea } from './text-area'

const meta: Meta<typeof TextArea> = {
  title: 'Components/TextArea',
  component: TextArea,
  args: {
    label: 'ご要望',
    name: 'notes',
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDescription: Story = {
  args: { description: '当日のスタッフが読みます。1,000 文字まで' },
}

export const Required: Story = {
  args: { label: 'キャンセルの理由', name: 'reason', required: true },
}

export const WithError: Story = {
  args: {
    label: 'キャンセルの理由',
    name: 'reason',
    required: true,
    error: 'キャンセルの理由を入力してください',
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: '前髪は短めでお願いします。' },
}

export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: '前髪は短めでお願いします。' },
}
