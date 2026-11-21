import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FieldRow } from '../field-row/field-row'
import { Form } from '../form/form'
import { TextField } from '../text-field/text-field'
import { FormPart } from './form-part'

const meta: Meta<typeof FormPart> = {
  title: 'Components/FormPart',
  component: FormPart,
  args: {
    name: '連絡先',
    children: (
      <>
        <TextField
          label='メールアドレス'
          name='email'
          type='email'
          autoComplete='email'
        />
        <TextField
          label='電話番号'
          name='phoneNumber'
          type='tel'
          autoComplete='tel'
        />
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** What the part says of all its controls stands before them */
export const WithNote: Story = {
  args: {
    note: 'どちらか一つは入れてください。予約の確認に使います。',
  },
}

/** A part whose controls cannot be changed now */
export const Disabled: Story = {
  args: { disabled: true },
}

/** The parts of a form, one below the other, and two controls read together */
export const InAForm: Story = {
  render: (part) => (
    <Form submitLabel='登録する' onSubmit={fn()}>
      <FormPart name='お名前'>
        <FieldRow>
          <TextField
            label='姓'
            name='lastName'
            autoComplete='family-name'
            required
          />
          <TextField
            label='名'
            name='firstName'
            autoComplete='given-name'
            required
          />
        </FieldRow>
      </FormPart>
      <FormPart {...part} />
    </Form>
  ),
}
