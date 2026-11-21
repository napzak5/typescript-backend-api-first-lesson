import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Button } from '../button/button'
import { FieldRow } from '../field-row/field-row'
import { FormPart } from '../form-part/form-part'
import { TextField } from '../text-field/text-field'
import { FormRow } from './form-row'

const meta: Meta<typeof FormRow> = {
  title: 'Components/FormRow',
  component: FormRow,
  args: {
    label: '1 件目の施術',
    children: (
      <>
        <FieldRow>
          <TextField label='施術' name='rows.0.treatment' autoComplete='off' />
          <TextField
            label='施術日'
            name='rows.0.date'
            autoComplete='off'
            type='date'
          />
        </FieldRow>
        <Button size='small' onClick={fn()}>
          外す
        </Button>
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The rows of a part of a form, one below the other */
export const InAPart: Story = {
  render: (args) => (
    <FormPart label='過去の施術'>
      <FormRow {...args} />
      <FormRow label='2 件目の施術'>
        <TextField label='施術' name='rows.1.treatment' autoComplete='off' />
      </FormRow>
    </FormPart>
  ),
}
