import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TextField } from './text-field'

const meta: Meta<typeof TextField> = {
  title: 'Components/TextField',
  component: TextField,
  args: {
    label: 'お名前',
    name: 'name',
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDescription: Story = {
  args: {
    label: '電話番号',
    name: 'phoneNumber',
    type: 'tel',
    autoComplete: 'tel',
    description: 'ハイフンなしで入力してください',
  },
}

export const Required: Story = {
  args: { required: true },
}

export const WithError: Story = {
  args: {
    label: 'メールアドレス',
    name: 'email',
    type: 'email',
    defaultValue: 'hanako@',
    description: '予約の確認をお送りします',
    error: 'メールアドレスの形式で入力してください',
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: '山田 花子' },
}

export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: '山田 花子' },
}

export const Password: Story = {
  args: {
    label: 'パスワード',
    name: 'password',
    type: 'password',
    autoComplete: 'current-password',
    required: true,
  },
}

/** A short value: the control is as wide as the date, the label and the description as the column */
export const DateInput: Story = {
  args: {
    label: '来店日',
    name: 'visitDate',
    type: 'date',
    width: 'short',
    defaultValue: '2026-12-03',
    description: 'ご来店の日を選んでください',
  },
}
