import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { RadioGroup } from './radio-group'

const meta: Meta<typeof RadioGroup> = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  args: {
    label: 'お支払い方法',
    name: 'paymentMethod',
    options: [
      { value: 'cash', label: '現金' },
      { value: 'creditCard', label: 'クレジットカード' },
      { value: 'electronicMoney', label: '電子マネー' },
    ],
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Chosen: Story = {
  args: { defaultValue: 'creditCard' },
}

export const WithDescription: Story = {
  args: { description: 'お会計のときに変更できます' },
}

export const Required: Story = {
  args: { required: true },
}

export const WithError: Story = {
  args: { required: true, error: 'お支払い方法を選択してください' },
}

export const WithUnavailableOption: Story = {
  args: {
    options: [
      { value: 'cash', label: '現金' },
      { value: 'creditCard', label: 'クレジットカード' },
      {
        value: 'electronicMoney',
        label: '電子マネー（この店舗では使えません）',
        disabled: true,
      },
    ],
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'cash' },
}
