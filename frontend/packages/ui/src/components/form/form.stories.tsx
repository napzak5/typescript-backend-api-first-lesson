import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Button } from '../button/button'
import { PasswordField } from '../password-field/password-field'
import { RadioGroup } from '../radio-group/radio-group'
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

type GuestsFormProps = Omit<FormProps, 'children'> & {
  /** The choice the form opens with */
  chosen?: string | undefined
}

/** A form that begins with a choice among a few. */
const GuestsForm = ({ errors, chosen, ...form }: GuestsFormProps) => (
  <Form {...form} errors={errors}>
    <RadioGroup
      label='ご来店の人数'
      name='guests'
      required
      options={[
        { value: '1', label: '1 名' },
        { value: '2', label: '2 名' },
      ]}
      defaultValue={chosen}
      error={errors?.['guests']}
    />
    <TextField
      label='メールアドレス'
      name='email'
      type='email'
      error={errors?.['email']}
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

/**
 * A choice that was not made, in a form that begins with one. The group
 * says the error and cannot take the focus: its first button does
 */
export const WithChoiceError: Story = {
  args: {
    errors: {
      guests: '人数を選んでください。',
      email: 'メールアドレスの形式で入力してください。',
    },
  },
  render: (form) => <GuestsForm {...form} />,
}

/** A choice that was made and that the answer refuses: the chosen button takes the focus */
export const WithChoiceRefused: Story = {
  args: { errors: { guests: '2 名では予約できません。' } },
  render: (form) => <GuestsForm {...form} chosen='2' />,
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

/**
 * On a screen as narrow as a phone its buttons stand one below the other,
 * each as wide as the form: two of them do not always fit in a line.
 */
export const OnANarrowScreen: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  args: {
    submitLabel: '変更を保存する',
    actions: (
      <Button variant='quiet' onClick={fn()}>
        変更しないで戻る
      </Button>
    ),
  },
}
