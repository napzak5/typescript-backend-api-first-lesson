import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FileField } from './file-field'

const meta: Meta<typeof FileField> = {
  title: 'Components/FileField',
  component: FileField,
  args: {
    label: 'CSV ファイル',
    name: 'file',
    accept: '.csv,text/csv',
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDescription: Story = {
  args: {
    description: 'UTF-8 か Shift_JIS の、カンマで区切ったファイル',
  },
}

export const Required: Story = {
  args: { required: true },
}

export const WithError: Story = {
  args: {
    description: 'UTF-8 か Shift_JIS の、カンマで区切ったファイル',
    error: 'ファイルを選んでください',
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
