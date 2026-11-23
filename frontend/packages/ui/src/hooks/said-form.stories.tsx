import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  answerMessages,
  fieldMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { FormErrors } from '../components/form/error-focus'
import { Form, type FormProps } from '../components/form/form'
import { NO_ERRORS } from '../components/form/form-values'
import { TextField } from '../components/text-field/text-field'
import { useSaidForm } from './language'

type SaidFormProps = Omit<FormProps, 'children' | 'message' | 'errors'> & {
  message?: LocalizedText | undefined
  errors?: FormErrors<LocalizedText> | undefined
}

/**
 * A form of a package whose texts are messages: it says what the attempt
 * left in the language of the page, and gives the form the errors as they
 * came.
 */
const SaidForm = ({ message, errors = NO_ERRORS, ...form }: SaidFormProps) => {
  const said = useSaidForm(message, errors)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <TextField
        label='メールアドレス'
        name='email'
        type='email'
        autoComplete='email'
        error={said.errors['email']}
      />
      <TextField
        label='電話番号'
        name='phone'
        type='tel'
        autoComplete='tel'
        error={said.errors['phone']}
      />
    </Form>
  )
}

const meta: Meta<typeof SaidForm> = {
  title: 'Language/SaidForm',
  component: SaidForm,
  args: {
    submitLabel: '登録する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Unsent: Story = {
  args: { message: answerMessages.notSent },
}

export const WithErrors: Story = {
  args: {
    errors: {
      email: fieldMessages.emailMalformed,
      phone: undefined,
    },
  },
}
