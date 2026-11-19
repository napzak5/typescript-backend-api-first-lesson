import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn, userEvent } from 'storybook/test'
import { PasswordField } from './password-field'

const meta: Meta<typeof PasswordField> = {
  title: 'Components/PasswordField',
  component: PasswordField,
  args: {
    label: 'パスワード',
    name: 'password',
    autoComplete: 'new-password',
    onChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDescription: Story = {
  args: {
    required: true,
    description: '15 文字以上で入力してください。',
  },
}

export const Shown: Story = {
  args: { defaultValue: 'kirei na kami de dekakeru' },
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole('checkbox', { name: 'パスワードを表示する' }),
    )
  },
}

export const WithError: Story = {
  args: {
    label: '新しいパスワード',
    name: 'newPassword',
    required: true,
    defaultValue: 'mijikai',
    description: '15 文字以上で入力してください。',
    error: 'パスワードが短すぎます。15 文字以上で入力してください。',
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
