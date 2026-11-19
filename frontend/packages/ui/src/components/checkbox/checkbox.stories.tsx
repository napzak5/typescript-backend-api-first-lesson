import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Checkbox } from './checkbox'

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: {
    label: 'メールでお知らせを受け取る',
    name: 'marketingConsent',
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = {
  args: { defaultChecked: true },
}

export const WithDescription: Story = {
  args: { description: 'キャンペーンと、次回の予約のご案内をお送りします' },
}

export const Required: Story = {
  args: { label: '利用規約に同意する', name: 'terms', required: true },
}

export const WithError: Story = {
  args: {
    label: '利用規約に同意する',
    name: 'terms',
    required: true,
    error: '利用規約への同意が必要です',
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
}
