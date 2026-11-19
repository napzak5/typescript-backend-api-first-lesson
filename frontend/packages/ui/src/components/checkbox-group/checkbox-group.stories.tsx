import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CheckboxGroup } from './checkbox-group'

const meta: Meta<typeof CheckboxGroup> = {
  title: 'Components/CheckboxGroup',
  component: CheckboxGroup,
  args: {
    label: '連絡の方法',
    name: 'contactMethods',
    options: [
      { value: 'email', label: 'メール' },
      { value: 'sms', label: 'SMS' },
      { value: 'phone', label: '電話' },
    ],
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Chosen: Story = {
  args: { defaultValue: ['email', 'phone'] },
}

export const WithDescription: Story = {
  args: { description: 'いくつでも選べます' },
}

export const WithError: Story = {
  args: { error: '選択肢から選んでください' },
}

export const WithUnavailableOption: Story = {
  args: {
    options: [
      { value: 'email', label: 'メール' },
      {
        value: 'sms',
        label: 'SMS（電話番号の登録が必要です）',
        disabled: true,
      },
      { value: 'phone', label: '電話' },
    ],
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: ['email'] },
}

/** The kinds of a service: short, and too many for one column. */
export const InColumns: Story = {
  args: {
    label: '好みのメニュー',
    name: 'preferredServices',
    layout: 'columns',
    defaultValue: ['cut', 'color'],
    options: [
      { value: 'cut', label: 'カット' },
      { value: 'color', label: 'カラー' },
      { value: 'perm', label: 'パーマ' },
      { value: 'treatment', label: 'トリートメント' },
      { value: 'spa', label: 'スパ' },
      { value: 'styling', label: 'スタイリング' },
      { value: 'extension', label: 'エクステンション' },
      { value: 'other', label: 'その他' },
    ],
  },
}
