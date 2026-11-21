import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ReactNode, useState } from 'react'
import { fn } from 'storybook/test'
import { Alert } from '../alert/alert'
import { TextArea } from '../text-area/text-area'
import { TextField } from '../text-field/text-field'
import { FormDialog } from './form-dialog'

const meta: Meta<typeof FormDialog> = {
  title: 'Components/FormDialog',
  component: FormDialog,
  args: {
    open: true,
    onClose: fn(),
    onSubmit: fn(),
    title: '選んだ 2 人にタグを付けますか？',
    submitLabel: 'タグを付ける',
    children: (
      <TextField
        label='タグ'
        name='tag'
        autoComplete='off'
        description='50 文字まで。'
      />
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** What is sent cannot be undone: the button says so with its colour */
export const Dangerous: Story = {
  args: {
    title: '売上を取り消しますか？',
    description: '取り消した売上は、直すことも支払いを受けることもできません。',
    submitLabel: '取り消す',
    submitVariant: 'danger',
    children: (
      <TextArea
        label='取り消しの理由'
        name='voidReason'
        required
        description='取り消した売上に残ります。'
      />
    ),
  },
}

/** The answer to an attempt: what went wrong, and the control it was about */
export const WithErrors: Story = {
  args: {
    message: 'タグを付けられませんでした。',
    errors: { tag: '50 文字以内で入力してください。' },
    children: (
      <TextField
        label='タグ'
        name='tag'
        autoComplete='off'
        error='50 文字以内で入力してください。'
      />
    ),
  },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}

const ANSWER = (
  <Alert tone='info'>このタグは、選んだ 2 人にもう付いています。</Alert>
)

/** What the form brought, to be read before the dialog closes */
export const Answered: Story = {
  args: { answer: ANSWER },
}

/** The answer comes when the form is sent */
export const AnsweredOnSending: Story = {
  render: (args) => {
    const [answer, setAnswer] = useState<ReactNode>()

    return (
      <FormDialog
        {...args}
        answer={answer}
        onSubmit={(values) => {
          setAnswer(ANSWER)
          args.onSubmit(values)
        }}
      />
    )
  },
}
