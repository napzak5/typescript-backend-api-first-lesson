import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Button } from '../button/button'
import { PasswordField } from '../password-field/password-field'
import { TextField } from '../text-field/text-field'
import { Form, type FormProps } from './form'

/** A form as a screen builds one: each control is given its own error. */
const RegistrationForm = ({ errors, ...form }: Omit<FormProps, 'children'>) => (
  <Form {...form} errors={errors}>
    <TextField
      label='メールアドレス'
      name='email'
      type='email'
      autoComplete='username'
      required
      error={errors?.['email']}
    />
    <PasswordField
      label='パスワード'
      name='password'
      autoComplete='new-password'
      required
      description='15 文字以上で入力してください。'
      error={errors?.['password']}
    />
  </Form>
)

const meta: Meta<typeof RegistrationForm> = {
  title: 'Components/Form',
  component: RegistrationForm,
  args: {
    submitLabel: '登録する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithMessage: Story = {
  args: {
    message:
      '登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

export const WithErrors: Story = {
  args: {
    errors: {
      email: 'メールアドレスの形式で入力してください。',
      password: 'パスワードが短すぎます。15 文字以上で入力してください。',
    },
  },
}

export const WithOneError: Story = {
  args: {
    errors: {
      password: 'このパスワードは推測されやすいため、使えません。',
    },
  },
}

export const Pending: Story = {
  args: { pending: true },
}

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant='quiet' onClick={fn()}>
        やめる
      </Button>
    ),
  },
}
